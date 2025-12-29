"""
Transactions router with fraud analysis
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from app.database import get_db
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionResponse,
    TransactionListResponse,
    TransactionAnalysisRequest,
    TransactionAnalysisResponse,
    TransactionStatsResponse,
    DailyStatsResponse,
    TransactionReviewRequest
)
from app.utils.dependencies import get_current_user, get_admin_user
from app.services.fraud_detection import fraud_detection_service
from app.services.llm_explainer import llm_explainer_service
from app.middleware.audit import AuditLogger, get_client_ip

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def generate_transaction_ref() -> str:
    """Generate unique transaction reference"""
    return f"TXN-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new transaction
    
    Creates a transaction record. Does not automatically analyze for fraud.
    Use POST /transactions/{id}/analyze to perform fraud analysis.
    """
    transaction = Transaction(
        transaction_ref=generate_transaction_ref(),
        amount=transaction_data.amount,
        currency=transaction_data.currency,
        sender_account=transaction_data.sender_account,
        receiver_account=transaction_data.receiver_account,
        sender_name=transaction_data.sender_name,
        receiver_name=transaction_data.receiver_name,
        transaction_type=transaction_data.transaction_type,
        channel=transaction_data.channel,
        country_origin=transaction_data.country_origin,
        country_destination=transaction_data.country_destination,
        ip_address=transaction_data.ip_address or get_client_ip(request),
        device_id=transaction_data.device_id,
        merchant_category=transaction_data.merchant_category,
        description=transaction_data.description,
        transaction_date=transaction_data.transaction_date
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    # Log creation
    AuditLogger.log_action(
        db=db,
        user_id=current_user.id,
        action="create_transaction",
        resource_type="transaction",
        resource_id=transaction.id,
        details={"amount": float(transaction.amount), "type": transaction.transaction_type},
        ip_address=get_client_ip(request)
    )
    
    return transaction


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    is_suspicious: Optional[bool] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    sort_by: str = "transaction_date",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List transactions with filtering and pagination
    
    - **page**: Page number (starting from 1)
    - **page_size**: Number of items per page (max 100)
    - **status**: Filter by status (pending, analyzed, reviewed, confirmed_fraud, cleared)
    - **is_suspicious**: Filter by suspicious flag
    - **min_amount**: Minimum transaction amount
    - **max_amount**: Maximum transaction amount
    - **start_date**: Filter transactions after this date
    - **end_date**: Filter transactions before this date
    - **search**: Search in transaction reference, sender/receiver names
    """
    query = db.query(Transaction)
    
    # Apply filters
    if status:
        query = query.filter(Transaction.status == status)
    
    if is_suspicious is not None:
        query = query.filter(Transaction.is_suspicious == is_suspicious)
    
    if min_amount:
        query = query.filter(Transaction.amount >= min_amount)
    
    if max_amount:
        query = query.filter(Transaction.amount <= max_amount)
    
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Transaction.transaction_ref.ilike(search_term)) |
            (Transaction.sender_name.ilike(search_term)) |
            (Transaction.receiver_name.ilike(search_term))
        )
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    sort_column = getattr(Transaction, sort_by, Transaction.transaction_date)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)
    
    # Apply pagination
    offset = (page - 1) * page_size
    transactions = query.offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return TransactionListResponse(
        items=transactions,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/stats", response_model=TransactionStatsResponse)
async def get_transaction_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get dashboard statistics
    
    Returns aggregate statistics about transactions and fraud detection
    """
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total counts
    total = db.query(Transaction).count()
    suspicious = db.query(Transaction).filter(Transaction.is_suspicious == True).count()
    confirmed_fraud = db.query(Transaction).filter(Transaction.is_confirmed_fraud == True).count()
    pending = db.query(Transaction).filter(Transaction.status == TransactionStatus.PENDING.value).count()
    
    # Average fraud score
    avg_score = db.query(func.avg(Transaction.fraud_score)).filter(
        Transaction.fraud_score.isnot(None)
    ).scalar()
    
    # Total fraud amount
    fraud_amount = db.query(func.sum(Transaction.amount)).filter(
        Transaction.is_confirmed_fraud == True
    ).scalar()
    
    # Today's transactions
    today_count = db.query(Transaction).filter(
        Transaction.transaction_date >= today
    ).count()
    
    # High risk count (score >= 85)
    high_risk = db.query(Transaction).filter(
        Transaction.fraud_score >= 85
    ).count()
    
    return TransactionStatsResponse(
        total_transactions=total,
        suspicious_count=suspicious,
        confirmed_fraud_count=confirmed_fraud,
        pending_review=pending,
        average_fraud_score=float(avg_score) if avg_score else None,
        total_fraud_amount=fraud_amount,
        transactions_today=today_count,
        high_risk_count=high_risk
    )


@router.get("/daily-stats", response_model=List[DailyStatsResponse])
async def get_daily_stats(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get daily statistics for charts
    
    Returns transaction counts and fraud amounts grouped by day
    """
    start_date = datetime.now() - timedelta(days=days)
    
    results = db.query(
        func.date(Transaction.transaction_date).label('date'),
        func.count(Transaction.id).label('total'),
        func.count(Transaction.id).filter(Transaction.is_suspicious == True).label('suspicious'),
        func.coalesce(
            func.sum(Transaction.amount).filter(Transaction.is_confirmed_fraud == True),
            0
        ).label('fraud_amount')
    ).filter(
        Transaction.transaction_date >= start_date
    ).group_by(
        func.date(Transaction.transaction_date)
    ).order_by(
        func.date(Transaction.transaction_date)
    ).all()
    
    return [
        DailyStatsResponse(
            date=str(r.date),
            total=r.total,
            suspicious=r.suspicious,
            fraud_amount=r.fraud_amount
        )
        for r in results
    ]


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific transaction by ID
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction non trouvée"
        )
    
    return transaction


@router.get("/analysis/in-progress", response_model=List[TransactionResponse])
async def get_analyzing_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all transactions currently being analyzed
    Returns transactions with status 'analyzing'
    """
    from loguru import logger
    logger.info("[API] Recuperation des transactions en cours d'analyse...")
    
    transactions = db.query(Transaction).filter(
        Transaction.status == TransactionStatus.ANALYZING.value
    ).order_by(desc(Transaction.analysis_date)).all()
    
    logger.info(f"[API] {len(transactions)} transaction(s) en cours d'analyse")
    return transactions


@router.post("/{transaction_id}/start-analysis")
async def start_analysis(
    transaction_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start analysis for a transaction - Sets status to 'analyzing'
    This is called first to mark the transaction as being analyzed
    """
    from loguru import logger
    
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")
    
    # Mark as analyzing
    transaction.status = TransactionStatus.ANALYZING.value
    transaction.analysis_date = datetime.utcnow()
    db.commit()
    
    logger.info(f"[API] 🚀 Analyse demarree pour transaction: {transaction.transaction_ref}")
    
    return {
        "success": True,
        "message": f"Analyse demarree pour {transaction.transaction_ref}",
        "transaction_id": str(transaction.id),
        "status": "analyzing"
    }


@router.post("/{transaction_id}/analyze", response_model=TransactionAnalysisResponse)
async def analyze_transaction(
    transaction_id: UUID,
    request: Request,
    analysis_request: TransactionAnalysisRequest = TransactionAnalysisRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze a transaction for fraud
    
    Performs fraud detection using IsolationForest model and generates
    an AI explanation using Mistral LLM.
    
    - **force_reanalysis**: If true, re-analyze even if already analyzed
    """
    from loguru import logger
    
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction non trouvée"
        )
    
    # Check if already analyzed
    if transaction.fraud_score is not None and not analysis_request.force_reanalysis:
        logger.info(f"[API] Transaction {transaction.transaction_ref} deja analysee - score: {transaction.fraud_score}")
        # Return existing analysis
        return TransactionAnalysisResponse(
            transaction_id=transaction.id,
            transaction_ref=transaction.transaction_ref,
            fraud_score=transaction.fraud_score,
            is_suspicious=transaction.is_suspicious,
            risk_level=transaction.risk_level,
            ai_explanation=transaction.ai_explanation or "Analyse précédente - aucune explication disponible",
            analysis_date=transaction.analysis_date,
            factors=[]
        )
    
    # Mark as analyzing first
    logger.info(f"[API] 🔄 Passage au statut 'analyzing' pour {transaction.transaction_ref}")
    transaction.status = TransactionStatus.ANALYZING.value
    transaction.analysis_date = datetime.utcnow()
    db.commit()
    
    # Perform fraud analysis (with detailed logs)
    logger.info(f"[API] 🤖 Lancement de l'analyse IA...")
    fraud_score, is_suspicious, risk_factors = fraud_detection_service.analyze_transaction(transaction, db)
    
    # Generate AI explanation
    logger.info(f"[API] 📝 Generation de l'explication LLM...")
    ai_explanation = await llm_explainer_service.explain_transaction(
        transaction=transaction,
        fraud_score=fraud_score,
        risk_factors=risk_factors
    )
    
    # Update transaction with results
    transaction.fraud_score = fraud_score
    transaction.is_suspicious = is_suspicious
    transaction.ai_explanation = ai_explanation
    transaction.analysis_date = datetime.utcnow()
    transaction.status = TransactionStatus.ANALYZED.value
    
    db.commit()
    db.refresh(transaction)
    
    logger.info(f"[API] ✅ Analyse terminee - Score: {fraud_score}/100 - Suspect: {is_suspicious}")
    
    # Log analysis
    AuditLogger.log_transaction_analysis(
        db=db,
        user_id=current_user.id,
        transaction_id=transaction.id,
        fraud_score=fraud_score,
        is_suspicious=is_suspicious,
        ip_address=get_client_ip(request)
    )
    
    return TransactionAnalysisResponse(
        transaction_id=transaction.id,
        transaction_ref=transaction.transaction_ref,
        fraud_score=fraud_score,
        is_suspicious=is_suspicious,
        risk_level=transaction.risk_level,
        ai_explanation=ai_explanation,
        analysis_date=transaction.analysis_date,
        factors=risk_factors
    )


@router.post("/{transaction_id}/review")
async def review_transaction(
    transaction_id: UUID,
    request: Request,
    review_data: TransactionReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Review and mark a transaction as fraud or cleared
    
    - **is_confirmed_fraud**: True if confirmed as fraud, False if cleared
    - **review_notes**: Optional notes from the reviewer
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction non trouvée"
        )
    
    # Update review fields
    transaction.is_confirmed_fraud = review_data.is_confirmed_fraud
    transaction.review_notes = review_data.review_notes
    transaction.reviewed_by = current_user.id
    transaction.reviewed_at = datetime.utcnow()
    transaction.status = (
        TransactionStatus.CONFIRMED_FRAUD.value 
        if review_data.is_confirmed_fraud 
        else TransactionStatus.CLEARED.value
    )
    
    db.commit()
    
    # Log review
    AuditLogger.log_transaction_review(
        db=db,
        user_id=current_user.id,
        transaction_id=transaction.id,
        is_confirmed_fraud=review_data.is_confirmed_fraud,
        notes=review_data.review_notes,
        ip_address=get_client_ip(request)
    )
    
    return {
        "message": "Transaction revue avec succès",
        "status": transaction.status
    }


# =============================================================================
# NOUVELLES ACTIONS FRAUDE
# =============================================================================

@router.post("/{transaction_id}/block")
async def block_transaction(
    transaction_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    BLOQUER une transaction suspecte
    
    Bloque immediatement le virement et le marque comme fraude confirmee.
    Utilise en cas de fraude averee ou de risque critique.
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvee")
    
    # Mettre a jour le statut
    transaction.status = TransactionStatus.CONFIRMED_FRAUD.value
    transaction.is_confirmed_fraud = True
    transaction.is_blocked = True
    transaction.blocked_at = datetime.utcnow()
    transaction.blocked_by = current_user.id
    transaction.review_notes = f"BLOQUE par {current_user.full_name} - Fraude confirmee"
    transaction.reviewed_by = current_user.id
    transaction.reviewed_at = datetime.utcnow()
    
    db.commit()
    
    # Log l'action
    AuditLogger.log_action(
        db=db,
        user_id=current_user.id,
        action="block_transaction",
        resource_type="transaction",
        resource_id=transaction.id,
        details={
            "amount": float(transaction.amount),
            "reason": "Fraude confirmee - Virement bloque"
        },
        ip_address=get_client_ip(request)
    )
    
    return {
        "success": True,
        "message": f"Transaction {transaction.transaction_ref} BLOQUEE avec succes",
        "action": "block",
        "status": "confirmed_fraud",
        "blocked_at": transaction.blocked_at.isoformat(),
        "blocked_by": current_user.full_name
    }


@router.post("/{transaction_id}/ticket")
async def create_fraud_ticket(
    transaction_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    OUVRIR UN TICKET FRAUDE
    
    Cree un ticket d'investigation pour l'equipe Conformite/Fraude.
    La transaction reste en attente pendant l'enquete.
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvee")
    
    # Generer un numero de ticket
    ticket_number = f"FRD-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    
    # Mettre a jour la transaction
    transaction.status = "under_investigation"
    transaction.ticket_number = ticket_number
    transaction.ticket_created_at = datetime.utcnow()
    transaction.ticket_created_by = current_user.id
    transaction.review_notes = f"Ticket {ticket_number} ouvert par {current_user.full_name} - Investigation en cours"
    
    db.commit()
    
    # Log l'action
    AuditLogger.log_action(
        db=db,
        user_id=current_user.id,
        action="create_fraud_ticket",
        resource_type="transaction",
        resource_id=transaction.id,
        details={
            "ticket_number": ticket_number,
            "amount": float(transaction.amount),
            "fraud_score": transaction.fraud_score
        },
        ip_address=get_client_ip(request)
    )
    
    return {
        "success": True,
        "message": f"Ticket fraude cree avec succes",
        "action": "ticket",
        "ticket_number": ticket_number,
        "status": "under_investigation",
        "created_at": transaction.ticket_created_at.isoformat(),
        "created_by": current_user.full_name,
        "transaction_ref": transaction.transaction_ref,
        "amount": float(transaction.amount),
        "fraud_score": transaction.fraud_score
    }


@router.post("/{transaction_id}/call-client")
async def call_client(
    transaction_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    APPELER LE CLIENT
    
    Enregistre une demande d'appel client pour verification.
    La transaction reste en attente de confirmation telephonique.
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvee")
    
    # Generer un ID d'appel
    call_id = f"CALL-{datetime.now().strftime('%Y%m%d%H%M')}-{uuid4().hex[:4].upper()}"
    
    # Mettre a jour la transaction
    transaction.status = "pending_call"
    transaction.call_requested = True
    transaction.call_requested_at = datetime.utcnow()
    transaction.call_requested_by = current_user.id
    previous_notes = transaction.review_notes or ""
    transaction.review_notes = f"{previous_notes}\n[{datetime.now().strftime('%d/%m/%Y %H:%M')}] Appel client demande par {current_user.full_name} (ID: {call_id})"
    
    db.commit()
    
    # Log l'action
    AuditLogger.log_action(
        db=db,
        user_id=current_user.id,
        action="request_client_call",
        resource_type="transaction",
        resource_id=transaction.id,
        details={
            "call_id": call_id,
            "sender_name": transaction.sender_name,
            "amount": float(transaction.amount)
        },
        ip_address=get_client_ip(request)
    )
    
    return {
        "success": True,
        "message": f"Demande d'appel client enregistree",
        "action": "call_client",
        "call_id": call_id,
        "status": "pending_call",
        "client_name": transaction.sender_name,
        "transaction_ref": transaction.transaction_ref,
        "amount": float(transaction.amount),
        "requested_at": transaction.call_requested_at.isoformat(),
        "requested_by": current_user.full_name,
        "instructions": "Contacter le client pour confirmer la transaction. Verifier son identite avant validation."
    }


@router.post("/{transaction_id}/approve")
async def approve_transaction(
    transaction_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    LAISSER PASSER (Fausse alerte)
    
    Approuve la transaction et la marque comme fausse alerte.
    Utilise quand l'analyse revele que la transaction est legitime.
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvee")
    
    # Mettre a jour le statut
    transaction.status = TransactionStatus.CLEARED.value
    transaction.is_confirmed_fraud = False
    transaction.is_false_positive = True
    transaction.cleared_at = datetime.utcnow()
    transaction.cleared_by = current_user.id
    transaction.reviewed_by = current_user.id
    transaction.reviewed_at = datetime.utcnow()
    previous_notes = transaction.review_notes or ""
    transaction.review_notes = f"{previous_notes}\n[{datetime.now().strftime('%d/%m/%Y %H:%M')}] APPROUVE par {current_user.full_name} - Fausse alerte confirmee"
    
    db.commit()
    
    # Log l'action
    AuditLogger.log_action(
        db=db,
        user_id=current_user.id,
        action="approve_transaction",
        resource_type="transaction",
        resource_id=transaction.id,
        details={
            "amount": float(transaction.amount),
            "original_score": transaction.fraud_score,
            "reason": "Fausse alerte - Transaction legitime"
        },
        ip_address=get_client_ip(request)
    )
    
    return {
        "success": True,
        "message": f"Transaction {transaction.transaction_ref} APPROUVEE - Fausse alerte",
        "action": "approve",
        "status": "cleared",
        "cleared_at": transaction.cleared_at.isoformat(),
        "cleared_by": current_user.full_name,
        "original_fraud_score": transaction.fraud_score,
        "final_status": "Fausse alerte confirmee"
    }


@router.post("/{transaction_id}/call-result")
async def record_call_result(
    transaction_id: UUID,
    request: Request,
    confirmed_by_client: bool = True,
    notes: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ENREGISTRER LE RESULTAT DE L'APPEL CLIENT
    
    Enregistre si le client a confirme ou infirme la transaction lors de l'appel.
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvee")
    
    # Mettre a jour selon la reponse du client
    transaction.call_completed = True
    transaction.call_completed_at = datetime.utcnow()
    transaction.call_completed_by = current_user.id
    
    if confirmed_by_client:
        # Client confirme = transaction legitime
        transaction.status = TransactionStatus.CLEARED.value
        transaction.is_confirmed_fraud = False
        transaction.is_false_positive = True
        result_text = "CONFIRMEE par le client"
    else:
        # Client nie = fraude
        transaction.status = TransactionStatus.CONFIRMED_FRAUD.value
        transaction.is_confirmed_fraud = True
        transaction.is_blocked = True
        transaction.blocked_at = datetime.utcnow()
        result_text = "NIEE par le client - FRAUDE"
    
    transaction.reviewed_by = current_user.id
    transaction.reviewed_at = datetime.utcnow()
    previous_notes = transaction.review_notes or ""
    transaction.review_notes = f"{previous_notes}\n[{datetime.now().strftime('%d/%m/%Y %H:%M')}] Resultat appel: {result_text}. Notes: {notes}"
    
    db.commit()
    
    # Log l'action
    AuditLogger.log_action(
        db=db,
        user_id=current_user.id,
        action="record_call_result",
        resource_type="transaction",
        resource_id=transaction.id,
        details={
            "confirmed_by_client": confirmed_by_client,
            "notes": notes,
            "final_status": transaction.status
        },
        ip_address=get_client_ip(request)
    )
    
    return {
        "success": True,
        "message": f"Resultat de l'appel enregistre",
        "confirmed_by_client": confirmed_by_client,
        "final_status": transaction.status,
        "is_fraud": transaction.is_confirmed_fraud
    }


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    request: Request,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """
    Delete a transaction (Admin only)
    """
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction non trouvée"
        )
    
    # Log deletion
    AuditLogger.log_action(
        db=db,
        user_id=current_user.id,
        action="delete_transaction",
        resource_type="transaction",
        resource_id=transaction.id,
        details={"transaction_ref": transaction.transaction_ref},
        ip_address=get_client_ip(request)
    )
    
    db.delete(transaction)
    db.commit()
