"""
BPCE Fraud Detection Platform - Main Application
FastAPI backend for fraud detection with AI-powered explanations
"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from loguru import logger
import sys
import os

from app.config import settings
from app.database import init_db, engine, Base
from app.routers import auth_router, transactions_router
from app.services.fraud_detection import fraud_detection_service
from app.services.llm_explainer import llm_explainer_service


# Configure logging
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)

# Create logs directory if not exists
os.makedirs("logs", exist_ok=True)
logger.add(
    "logs/app.log",
    rotation="10 MB",
    retention="7 days",
    level="DEBUG"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("🚀 Starting BPCE Fraud Detection Platform...")
    
    # Initialize database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables initialized")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
    
    # Check fraud detection model
    model_status = fraud_detection_service.get_model_status()
    if model_status["model_loaded"]:
        logger.info("✅ Fraud detection model loaded")
    else:
        logger.warning("⚠️ Fraud detection model not loaded - will use rule-based scoring")
    
    # Check Ollama/LLM status
    llm_status = await llm_explainer_service.check_ollama_status()
    if llm_status["status"] == "connected":
        logger.info(f"✅ Ollama connected - Model: {llm_status['model']}")
    else:
        logger.warning(f"⚠️ Ollama not available - Using fallback explanations")
    
    logger.info(f"✅ {settings.app_name} v{settings.app_version} started successfully")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down BPCE Fraud Detection Platform...")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
## BPCE Fraud Detection Platform API

Plateforme de détection de fraude bancaire avec intelligence artificielle.

### Fonctionnalités

* 🔐 **Authentification JWT** - Connexion sécurisée avec tokens
* 💳 **Gestion des transactions** - CRUD complet des transactions bancaires
* 🤖 **Détection IA** - Analyse par IsolationForest + scoring hybride
* 💬 **Explications LLM** - Génération d'explications par Mistral
* 📊 **Dashboard** - Statistiques et métriques en temps réel
* 📝 **Audit** - Traçabilité complète des actions

### Authentification

Utilisez le endpoint `/auth/login` pour obtenir un token JWT.
Incluez le token dans le header `Authorization: Bearer <token>` pour les requêtes authentifiées.

### Utilisateurs par défaut

* **Admin**: admin@bpce.fr / Admin123!
* **Analyst**: analyst@bpce.fr / Admin123!
    """,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS middleware
# CORS middleware - Allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with French messages"""
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Erreur de validation des données",
            "errors": errors
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected errors"""
    logger.error(f"Unexpected error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Une erreur interne est survenue",
            "error": str(exc) if settings.debug else None
        }
    )


# Include routers
app.include_router(auth_router)
app.include_router(transactions_router)


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint
    
    Returns the current status of all services
    """
    # Check database
    db_status = "healthy"
    try:
        from app.database import SessionLocal
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    # Check fraud model
    model_status = fraud_detection_service.get_model_status()
    
    # Check LLM
    llm_status = await llm_explainer_service.check_ollama_status()
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "version": settings.app_version,
        "services": {
            "database": db_status,
            "fraud_model": "loaded" if model_status["model_loaded"] else "not_loaded",
            "llm": llm_status["status"]
        }
    }


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - API information
    """
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "documentation": "/docs",
        "health": "/health"
    }


@app.get("/api/model/status", tags=["Model"])
async def get_model_status():
    """
    Get fraud detection model status
    """
    model_status = fraud_detection_service.get_model_status()
    llm_status = await llm_explainer_service.check_ollama_status()
    
    return {
        "fraud_detection": model_status,
        "llm_explainer": llm_status
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
