"""
Configuration settings for the Fraud Detection Platform
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    app_name: str = "BPCE Fraud Detection Platform"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Database
    database_url: str = "postgresql://fraudadmin:SecurePass123!@localhost:5432/fraud_detection"
    
    # JWT Authentication
    secret_key: str = "your-super-secret-key-change-in-production-min-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Ollama LLM Configuration
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "mistral:7b-instruct"
    
    # Fraud Detection Thresholds
    fraud_score_threshold: int = 70
    high_risk_threshold: int = 85
    
    # Model paths
    model_path: str = "/app/models/isolation_forest.joblib"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
