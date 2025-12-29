#!/usr/bin/env python3
"""
Script pour créer des transactions suspectes et des fraudes confirmées
pour la démonstration
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
import random

from app.database import SessionLocal
from app.models.transaction import Transaction, TransactionStatus
from app.services.fraud_detection import fraud_detection_service


def generate_transaction_ref():
    return f"TXN-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"


def generate_iban(country="FR"):
    if country == "FR":
        return f"FR76{random.randint(10000, 99999)}{random.randint(10000, 99999)}{random.randint(10000000000, 99999999999)}{random.randint(10, 99)}"
    return f"{country}00{random.randint(10**18, 10**19-1)}"


def create_demo_transactions():
    """Créer des transactions de démonstration avec différents statuts"""
    
    db = SessionLocal()
    
    try:
        print("🚨 Création de transactions suspectes et fraudes confirmées...")
        
        # === FRAUDES CONFIRMÉES ===
        confirmed_frauds = [
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("45000.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("RU"),
                "sender_name": "Jean-Pierre Dupont",
                "receiver_name": "Unknown Entity LLC",
                "transaction_type": "virement",
                "channel": "web",
                "country_origin": "FRA",
                "country_destination": "RUS",
                "description": "Transfert urgent - Business",
                "transaction_date": datetime.now() - timedelta(hours=3),
                "fraud_score": 95,
                "is_suspicious": True,
                "is_confirmed_fraud": True,
                "status": TransactionStatus.CONFIRMED_FRAUD.value,
                "ai_explanation": "🚨 FRAUDE CONFIRMÉE: Cette transaction présente tous les indicateurs d'une fraude sophistiquée. Le montant exceptionnel de 45 000€ a été transféré vers un compte en Russie, pays à haut risque. L'opération a été effectuée à une heure inhabituelle via le canal web. Le bénéficiaire 'Unknown Entity LLC' est une société écran connue. L'analyse comportementale montre une déviation majeure par rapport aux habitudes du client.",
                "review_notes": "Fraude confirmée après enquête. Compte bénéficiaire lié à un réseau de blanchiment."
            },
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("28500.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("NG"),
                "sender_name": "Marie Lefebvre",
                "receiver_name": "Global Trading Corp",
                "transaction_type": "virement",
                "channel": "mobile",
                "country_origin": "FRA",
                "country_destination": "NGA",
                "description": "Investment opportunity",
                "transaction_date": datetime.now() - timedelta(days=1, hours=2),
                "fraud_score": 92,
                "is_suspicious": True,
                "is_confirmed_fraud": True,
                "status": TransactionStatus.CONFIRMED_FRAUD.value,
                "ai_explanation": "🚨 FRAUDE CONFIRMÉE: Arnaque à l'investissement détectée. Le montant de 28 500€ a été envoyé vers le Nigeria suite à une manipulation psychologique. Le client a été victime d'une fraude de type 'romance scam' combinée à une fausse opportunité d'investissement. Le compte bénéficiaire a été signalé par plusieurs institutions.",
                "review_notes": "Victime d'arnaque sentimentale. Plainte déposée."
            },
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("15000.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("FR"),
                "sender_name": "Philippe Martin",
                "receiver_name": "Crypto Exchange SARL",
                "transaction_type": "virement",
                "channel": "web",
                "country_origin": "FRA",
                "country_destination": "FRA",
                "description": "Achat crypto urgent",
                "transaction_date": datetime.now() - timedelta(days=2),
                "fraud_score": 88,
                "is_suspicious": True,
                "is_confirmed_fraud": True,
                "status": TransactionStatus.CONFIRMED_FRAUD.value,
                "ai_explanation": "🚨 FRAUDE CONFIRMÉE: Usurpation d'identité détectée. Cette transaction n'a pas été initiée par le titulaire du compte. Les identifiants ont été compromis via une attaque de phishing. Le montant a été converti en cryptomonnaie immédiatement après réception.",
                "review_notes": "Compte compromis par phishing. Identifiants volés."
            }
        ]
        
        # === TRANSACTIONS SUSPECTES (en attente de revue) ===
        suspicious_transactions = [
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("12500.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("CN"),
                "sender_name": "Laurent Dubois",
                "receiver_name": "Shanghai Import Export Co",
                "transaction_type": "virement",
                "channel": "web",
                "country_origin": "FRA",
                "country_destination": "CHN",
                "description": "Paiement fournisseur",
                "transaction_date": datetime.now() - timedelta(hours=5),
                "fraud_score": 78,
                "is_suspicious": True,
                "is_confirmed_fraud": False,
                "status": TransactionStatus.ANALYZED.value,
                "ai_explanation": "⚠️ TRANSACTION SUSPECTE: Plusieurs indicateurs de risque détectés. Le montant de 12 500€ est significativement supérieur aux transactions habituelles de ce client. Le transfert vers la Chine constitue une première pour ce compte. Recommandation: Vérifier avec le client la légitimité de cette opération.",
            },
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("8750.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("FR"),
                "sender_name": "Sophie Bernard",
                "receiver_name": "Immobilier Express",
                "transaction_type": "virement",
                "channel": "mobile",
                "country_origin": "FRA",
                "country_destination": "FRA",
                "description": "Acompte appartement",
                "transaction_date": datetime.now() - timedelta(hours=8),
                "fraud_score": 72,
                "is_suspicious": True,
                "is_confirmed_fraud": False,
                "status": TransactionStatus.ANALYZED.value,
                "ai_explanation": "⚠️ TRANSACTION SUSPECTE: Montant rond inhabituel pour une transaction immobilière légitime. Le bénéficiaire 'Immobilier Express' n'apparaît pas dans les registres officiels des agences immobilières. Possible arnaque à la location. Vérification recommandée.",
            },
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("5000.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("MA"),
                "sender_name": "Thomas Petit",
                "receiver_name": "Mohammed Alami",
                "transaction_type": "virement",
                "channel": "agence",
                "country_origin": "FRA",
                "country_destination": "MAR",
                "description": "Aide familiale",
                "transaction_date": datetime.now() - timedelta(hours=12),
                "fraud_score": 65,
                "is_suspicious": True,
                "is_confirmed_fraud": False,
                "status": TransactionStatus.ANALYZED.value,
                "ai_explanation": "⚠️ TRANSACTION SUSPECTE: Transfert international vers le Maroc. Bien que les transferts familiaux soient courants, le montant exact de 5 000€ et la fréquence récente de transactions similaires nécessitent une vérification. Possible structuration pour éviter les seuils de déclaration.",
            },
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("19999.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("FR"),
                "sender_name": "Nicolas Roux",
                "receiver_name": "Auto Prestige",
                "transaction_type": "virement",
                "channel": "web",
                "country_origin": "FRA",
                "country_destination": "FRA",
                "description": "Achat véhicule",
                "transaction_date": datetime.now() - timedelta(hours=2),
                "fraud_score": 71,
                "is_suspicious": True,
                "is_confirmed_fraud": False,
                "status": TransactionStatus.ANALYZED.value,
                "ai_explanation": "⚠️ TRANSACTION SUSPECTE: Le montant de 19 999€ semble intentionnellement fixé juste sous le seuil de déclaration de 20 000€. Cette technique de 'structuration' est un indicateur classique de blanchiment d'argent. Le vendeur 'Auto Prestige' a été signalé dans d'autres enquêtes.",
            },
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("7200.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("TR"),
                "sender_name": "Isabelle Moreau",
                "receiver_name": "Istanbul Trading",
                "transaction_type": "virement",
                "channel": "web",
                "country_origin": "FRA",
                "country_destination": "TUR",
                "ip_address": "185.220.101.45",
                "description": "Achat marchandises",
                "transaction_date": datetime.now() - timedelta(hours=1),
                "fraud_score": 75,
                "is_suspicious": True,
                "is_confirmed_fraud": False,
                "status": TransactionStatus.ANALYZED.value,
                "ai_explanation": "⚠️ TRANSACTION SUSPECTE: L'adresse IP utilisée (185.220.101.45) est géolocalisée en dehors de la France, alors que le client est habituellement connecté depuis Paris. Possible compromission du compte ou utilisation d'un VPN suspect. Le bénéficiaire en Turquie ajoute au niveau de risque.",
            }
        ]
        
        # === TRANSACTIONS À HAUT RISQUE NON ANALYSÉES ===
        high_risk_pending = [
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("35000.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("AE"),
                "sender_name": "François Girard",
                "receiver_name": "Dubai Investments FZE",
                "transaction_type": "virement",
                "channel": "web",
                "country_origin": "FRA",
                "country_destination": "ARE",
                "description": "Investment partnership",
                "transaction_date": datetime.now() - timedelta(minutes=30),
                "status": TransactionStatus.PENDING.value,
            },
            {
                "transaction_ref": generate_transaction_ref(),
                "amount": Decimal("22000.00"),
                "currency": "EUR",
                "sender_account": generate_iban("FR"),
                "receiver_account": generate_iban("HK"),
                "sender_name": "Christine Lambert",
                "receiver_name": "HK Digital Assets Ltd",
                "transaction_type": "virement",
                "channel": "mobile",
                "country_origin": "FRA",
                "country_destination": "HKG",
                "description": "Crypto investment",
                "transaction_date": datetime.now() - timedelta(minutes=45),
                "status": TransactionStatus.PENDING.value,
            }
        ]
        
        # Insérer les fraudes confirmées
        print("\n💀 Insertion des fraudes confirmées...")
        for fraud_data in confirmed_frauds:
            fraud = Transaction(**fraud_data)
            db.add(fraud)
            print(f"   ✓ {fraud_data['transaction_ref']}: {fraud_data['amount']}€ → {fraud_data['country_destination']}")
        
        # Insérer les transactions suspectes
        print("\n⚠️ Insertion des transactions suspectes...")
        for sus_data in suspicious_transactions:
            sus = Transaction(**sus_data)
            db.add(sus)
            print(f"   ✓ {sus_data['transaction_ref']}: {sus_data['amount']}€ (Score: {sus_data['fraud_score']})")
        
        # Insérer les transactions à haut risque en attente
        print("\n🔍 Insertion des transactions à analyser...")
        for pending_data in high_risk_pending:
            pending = Transaction(**pending_data)
            db.add(pending)
            print(f"   ✓ {pending_data['transaction_ref']}: {pending_data['amount']}€ → {pending_data['country_destination']}")
        
        db.commit()
        
        # Afficher les statistiques
        total = db.query(Transaction).count()
        suspicious = db.query(Transaction).filter(Transaction.is_suspicious == True).count()
        frauds = db.query(Transaction).filter(Transaction.is_confirmed_fraud == True).count()
        pending = db.query(Transaction).filter(Transaction.status == 'pending').count()
        
        print("\n" + "="*50)
        print("📊 STATISTIQUES FINALES")
        print("="*50)
        print(f"   Total transactions:      {total}")
        print(f"   Transactions suspectes:  {suspicious}")
        print(f"   Fraudes confirmées:      {frauds}")
        print(f"   En attente d'analyse:    {pending}")
        print("="*50)
        print("\n✅ Données de démonstration créées avec succès!")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_demo_transactions()
