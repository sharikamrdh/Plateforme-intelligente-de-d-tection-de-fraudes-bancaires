"""
BPCE Fraud Detection Service - Version Amelioree
Detection automatique des fraudes avec scoring intelligent et analyse comportementale complete
"""
import numpy as np
import os
import joblib
import time
from datetime import datetime, timedelta
from typing import Tuple, List, Optional, Dict, Any
from decimal import Decimal
from loguru import logger
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, LabelEncoder

from app.config import settings
from app.models.transaction import Transaction


HIGH_RISK_COUNTRIES = {
    'NGA': 95, 'RUS': 85, 'IRN': 95, 'PRK': 99, 'AFG': 90,
    'SYR': 95, 'YEM': 85, 'PAK': 70, 'MMR': 80, 'VEN': 75,
    'HTI': 70, 'LBY': 85, 'SSD': 85, 'COD': 75, 'SOM': 90,
}

MEDIUM_RISK_COUNTRIES = {
    'CHN': 40, 'TUR': 45, 'ARE': 35, 'HKG': 30, 'PHL': 40,
    'THA': 35, 'MAR': 30, 'TUN': 30, 'SEN': 35, 'CIV': 40,
    'CMR': 40, 'BRA': 30, 'MEX': 35,
}

SUSPICIOUS_HOURS = [0, 1, 2, 3, 4, 5, 23]

SUSPICIOUS_KEYWORDS = [
    'crypto', 'bitcoin', 'btc', 'eth', 'trading', 'forex', 'invest',
    'exchange', 'wallet', 'coin', 'token', 'nft', 'urgent', 'immediat',
    'lottery', 'winner', 'prize', 'inheritance', 'prince', 'unknown',
    'anonymous', 'offshore', 'tax free'
]

RISKY_LEGAL_STRUCTURES = ['llc', 'fze', 'ltd', 'offshore', 'holdings', 'trust', 'foundation']


def log_separator():
    logger.info("=" * 70)


def log_step(step_num: int, total: int, message: str):
    logger.info(f"[ETAPE {step_num}/{total}] {message}")


class FraudDetectionService:
    """Service de detection de fraude bancaire"""
    
    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None
        self.label_encoders: dict = {}
        self.model_path = settings.model_path
        self.scaler_path = self.model_path.replace('.joblib', '_scaler.joblib')
        self.encoders_path = self.model_path.replace('.joblib', '_encoders.joblib')
        self.threshold = settings.fraud_score_threshold
        self._load_model()
    
    def _load_model(self) -> None:
        try:
            if os.path.exists(self.model_path):
                self.model = joblib.load(self.model_path)
                logger.info(f"[INIT] Modele IsolationForest charge: {self.model_path}")
            if os.path.exists(self.scaler_path):
                self.scaler = joblib.load(self.scaler_path)
            if os.path.exists(self.encoders_path):
                self.label_encoders = joblib.load(self.encoders_path)
        except Exception as e:
            logger.warning(f"[INIT] Impossible de charger le modele: {e}")
            self.model = None
    
    def _encode_categorical(self, name: str, value: str) -> int:
        if name not in self.label_encoders:
            self.label_encoders[name] = LabelEncoder()
            if name == 'channel':
                self.label_encoders[name].fit(['web', 'mobile', 'agence', 'atm', 'api'])
            elif name == 'transaction_type':
                self.label_encoders[name].fit(['virement', 'prelevement', 'carte', 'retrait', 'depot'])
        try:
            return self.label_encoders[name].transform([value])[0]
        except ValueError:
            return 0
    
    def _prepare_features(self, transaction: Transaction) -> np.ndarray:
        amount = float(transaction.amount)
        hour = transaction.transaction_date.hour
        day_of_week = transaction.transaction_date.weekday()
        dest = transaction.country_destination or 'FRA'
        country_risk = HIGH_RISK_COUNTRIES.get(dest, MEDIUM_RISK_COUNTRIES.get(dest, 0))
        
        features = {
            'amount': amount,
            'amount_log': np.log1p(amount),
            'hour': hour,
            'day_of_week': day_of_week,
            'is_weekend': 1 if day_of_week >= 5 else 0,
            'is_night': 1 if hour in SUSPICIOUS_HOURS else 0,
            'is_international': 1 if transaction.country_origin != dest else 0,
            'country_risk': country_risk,
            'is_high_risk_country': 1 if dest in HIGH_RISK_COUNTRIES else 0,
            'channel_encoded': self._encode_categorical('channel', transaction.channel or 'web'),
            'type_encoded': self._encode_categorical('transaction_type', transaction.transaction_type),
            'is_round_amount': 1 if amount % 100 == 0 else 0,
            'is_large_amount': 1 if amount > 5000 else 0,
            'is_very_large': 1 if amount > 10000 else 0,
        }
        return np.array(list(features.values())).reshape(1, -1)
    
    def train_model(self, transactions: List[Transaction]) -> dict:
        if len(transactions) < 10:
            raise ValueError("Minimum 10 transactions requises")
        
        logger.info(f"Entrainement sur {len(transactions)} transactions")
        X = np.vstack([self._prepare_features(t) for t in transactions])
        
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        self.model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42, n_jobs=-1)
        self.model.fit(X_scaled)
        
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        joblib.dump(self.label_encoders, self.encoders_path)
        
        logger.info(f"Modele sauvegarde: {self.model_path}")
        return {"status": "success", "samples_trained": len(transactions)}
    
    def analyze_transaction(self, transaction: Transaction, db_session=None) -> Tuple[int, bool, List[str]]:
        """Analyse complete avec logs temps reel"""
        all_factors = []
        score_components = []
        
        log_separator()
        logger.info(f"🔍 DEBUT ANALYSE TRANSACTION: {transaction.transaction_ref}")
        log_separator()
        logger.info(f"📋 DONNEES DE LA TRANSACTION:")
        logger.info(f"   - Reference: {transaction.transaction_ref}")
        logger.info(f"   - Montant: {transaction.amount} {transaction.currency}")
        logger.info(f"   - Type: {transaction.transaction_type}")
        logger.info(f"   - Canal: {transaction.channel}")
        logger.info(f"   - Date/Heure: {transaction.transaction_date}")
        logger.info(f"   - Expediteur: {transaction.sender_name}")
        logger.info(f"   - Beneficiaire: {transaction.receiver_name}")
        logger.info(f"   - Pays: {transaction.country_origin} -> {transaction.country_destination}")
        log_separator()
        
        time.sleep(0.3)
        
        # 1. ANALYSE ML
        log_step(1, 5, "ANALYSE PAR MODELE IA (IsolationForest)")
        logger.info("   ⏳ Chargement du modele ML...")
        time.sleep(0.2)
        ml_score, ml_factors = self._ml_analysis(transaction)
        score_components.append(('Modele IA', ml_score, 0.35))
        all_factors.extend(ml_factors)
        logger.info(f"   ✅ Score ML: {ml_score:.1f}/100")
        for f in ml_factors:
            logger.info(f"      → {f}")
        time.sleep(0.2)
        
        # 2. ANALYSE MONTANT
        log_step(2, 5, "ANALYSE DU MONTANT")
        logger.info(f"   ⏳ Verification du montant: {transaction.amount} EUR...")
        time.sleep(0.2)
        amount_score, amount_factors = self._analyze_amount(transaction, db_session)
        score_components.append(('Montant', amount_score, 0.25))
        all_factors.extend(amount_factors)
        logger.info(f"   ✅ Score Montant: {amount_score:.1f}/100")
        for f in amount_factors:
            logger.info(f"      → {f}")
        time.sleep(0.2)
        
        # 3. ANALYSE GEOGRAPHIQUE
        log_step(3, 5, "ANALYSE GEOGRAPHIQUE (Liste GAFI)")
        dest = transaction.country_destination or 'FRA'
        logger.info(f"   ⏳ Verification pays destination: {dest}...")
        time.sleep(0.2)
        geo_score, geo_factors = self._analyze_geography(transaction)
        score_components.append(('Geographie', geo_score, 0.20))
        all_factors.extend(geo_factors)
        logger.info(f"   ✅ Score Geographique: {geo_score:.1f}/100")
        for f in geo_factors:
            logger.info(f"      → {f}")
        time.sleep(0.2)
        
        # 4. ANALYSE TEMPORELLE
        log_step(4, 5, "ANALYSE TEMPORELLE")
        hour = transaction.transaction_date.hour
        logger.info(f"   ⏳ Verification heure: {hour}h...")
        time.sleep(0.2)
        time_score, time_factors = self._analyze_timing(transaction)
        score_components.append(('Horaire', time_score, 0.10))
        all_factors.extend(time_factors)
        logger.info(f"   ✅ Score Temporel: {time_score:.1f}/100")
        for f in time_factors:
            logger.info(f"      → {f}")
        time.sleep(0.2)
        
        # 5. ANALYSE BENEFICIAIRE
        log_step(5, 5, "ANALYSE DU BENEFICIAIRE")
        logger.info(f"   ⏳ Verification beneficiaire: {transaction.receiver_name}...")
        time.sleep(0.2)
        benef_score, benef_factors = self._analyze_beneficiary(transaction, db_session)
        score_components.append(('Beneficiaire', benef_score, 0.10))
        all_factors.extend(benef_factors)
        logger.info(f"   ✅ Score Beneficiaire: {benef_score:.1f}/100")
        for f in benef_factors:
            logger.info(f"      → {f}")
        time.sleep(0.2)
        
        # Calcul score final
        log_separator()
        logger.info("📊 CALCUL DU SCORE FINAL")
        logger.info("   Ponderation:")
        for name, score, weight in score_components:
            contribution = score * weight
            logger.info(f"      - {name}: {score:.1f} x {weight*100:.0f}% = {contribution:.1f}")
        
        final_score = sum(score * weight for _, score, weight in score_components)
        logger.info(f"   Score avant boosters: {final_score:.1f}/100")
        
        time.sleep(0.2)
        logger.info("   ⏳ Application des boosters de risque...")
        final_score = self._apply_risk_boosters(final_score, all_factors, transaction)
        final_score = min(100, max(0, final_score))
        
        is_suspicious = final_score >= self.threshold
        risk_level = self._get_risk_level(final_score)
        
        if is_suspicious:
            all_factors.append(f"Score de risque global: {final_score:.0f}/100 ({risk_level.upper()})")
        
        log_separator()
        if is_suspicious:
            if risk_level == 'critical':
                logger.warning(f"🚨🚨🚨 ALERTE CRITIQUE - SCORE: {final_score:.0f}/100 🚨🚨🚨")
            elif risk_level == 'high':
                logger.warning(f"🚨 ALERTE ELEVEE - SCORE: {final_score:.0f}/100")
            else:
                logger.warning(f"⚠️ TRANSACTION SUSPECTE - SCORE: {final_score:.0f}/100")
        else:
            logger.info(f"✅ TRANSACTION NORMALE - SCORE: {final_score:.0f}/100")
        
        logger.info(f"   Niveau de risque: {risk_level.upper()}")
        logger.info(f"   Seuil d'alerte: {self.threshold}")
        logger.info(f"   Nombre de facteurs detectes: {len(all_factors)}")
        log_separator()
        logger.info(f"🏁 FIN ANALYSE TRANSACTION: {transaction.transaction_ref}")
        log_separator()
        
        return int(round(final_score)), is_suspicious, all_factors
    
    def _ml_analysis(self, transaction: Transaction) -> Tuple[float, List[str]]:
        factors = []
        if not self.model or not self.scaler:
            logger.warning("   ⚠️ Modele ML non disponible")
            return 50.0, ["Modele ML en cours de chargement"]
        
        try:
            features = self._prepare_features(transaction)
            features_scaled = self.scaler.transform(features)
            prediction = self.model.predict(features_scaled)[0]
            score_raw = self.model.score_samples(features_scaled)[0]
            
            ml_score = 50 - (score_raw * 100)
            ml_score = max(0, min(100, ml_score))
            
            logger.info(f"   📈 Score brut IsolationForest: {score_raw:.4f}")
            logger.info(f"   📈 Prediction: {'ANOMALIE' if prediction == -1 else 'NORMAL'}")
            
            if prediction == -1:
                factors.append("Comportement anormal detecte par l'IA (IsolationForest)")
                ml_score = max(ml_score, 65)
            
            return ml_score, factors
        except Exception as e:
            logger.error(f"   ❌ Erreur ML: {e}")
            return 50.0, []
    
    def _analyze_amount(self, transaction: Transaction, db_session=None) -> Tuple[float, List[str]]:
        factors = []
        score = 0
        amount = float(transaction.amount)
        
        if amount >= 50000:
            score += 85
            factors.append(f"Montant TRES ELEVE: {amount:,.0f} EUR")
        elif amount >= 20000:
            score += 65
            factors.append(f"Montant eleve: {amount:,.0f} EUR")
        elif amount >= 10000:
            score += 45
            factors.append(f"Montant significatif: {amount:,.0f} EUR (seuil declaration)")
        elif amount >= 5000:
            score += 25
            factors.append(f"Montant notable: {amount:,.0f} EUR")
        
        if 9000 <= amount <= 9999:
            score += 40
            factors.append("STRUCTURATION POSSIBLE: montant juste sous 10 000 EUR")
        elif 19000 <= amount <= 19999:
            score += 45
            factors.append("STRUCTURATION POSSIBLE: montant juste sous 20 000 EUR")
        
        if amount >= 1000 and amount % 1000 == 0:
            score += 10
            factors.append(f"Montant rond: {amount:,.0f} EUR")
        
        return min(100, score), factors
    
    def _analyze_geography(self, transaction: Transaction) -> Tuple[float, List[str]]:
        factors = []
        score = 0
        dest = transaction.country_destination or 'FRA'
        origin = transaction.country_origin or 'FRA'
        
        if dest in HIGH_RISK_COUNTRIES:
            risk_score = HIGH_RISK_COUNTRIES[dest]
            score += risk_score
            factors.append(f"DESTINATION A HAUT RISQUE: {dest} (indice GAFI: {risk_score}%)")
        elif dest in MEDIUM_RISK_COUNTRIES:
            risk_score = MEDIUM_RISK_COUNTRIES[dest]
            score += risk_score
            factors.append(f"Destination a risque modere: {dest}")
        
        if dest != origin and dest != 'FRA':
            score += 15
            factors.append(f"Transaction internationale: {origin} vers {dest}")
        
        return min(100, score), factors
    
    def _analyze_timing(self, transaction: Transaction) -> Tuple[float, List[str]]:
        factors = []
        score = 0
        hour = transaction.transaction_date.hour
        day = transaction.transaction_date.weekday()
        
        if 0 <= hour <= 5:
            score += 60
            factors.append(f"Transaction NOCTURNE: {hour}h")
        elif hour == 23:
            score += 40
            factors.append(f"Transaction tardive: {hour}h")
        
        if day >= 5:
            amount = float(transaction.amount)
            if amount > 5000:
                score += 35
                factors.append(f"Transaction elevee le week-end ({amount:,.0f} EUR)")
            else:
                score += 15
                factors.append("Transaction le week-end")
        
        return min(100, score), factors
    
    def _analyze_beneficiary(self, transaction: Transaction, db_session=None) -> Tuple[float, List[str]]:
        factors = []
        score = 0
        
        receiver_name = (transaction.receiver_name or '').lower()
        description = (transaction.description or '').lower()
        text_to_check = f"{receiver_name} {description}"
        
        for keyword in SUSPICIOUS_KEYWORDS:
            if keyword in text_to_check:
                score += 40
                factors.append(f"Mot-cle suspect detecte: '{keyword}'")
                break
        
        for structure in RISKY_LEGAL_STRUCTURES:
            if structure in receiver_name:
                score += 25
                factors.append(f"Structure juridique a risque: {structure.upper()}")
                break
        
        if db_session:
            try:
                previous = db_session.query(Transaction).filter(
                    Transaction.sender_account == transaction.sender_account,
                    Transaction.receiver_account == transaction.receiver_account,
                    Transaction.id != transaction.id
                ).first()
                if not previous:
                    score += 35
                    factors.append("NOUVEAU BENEFICIAIRE: premiere transaction vers ce compte")
                    logger.info("   🆕 Premier transfert vers ce beneficiaire")
            except:
                pass
        
        return min(100, score), factors
    
    def _apply_risk_boosters(self, score: float, factors: List[str], transaction: Transaction) -> float:
        amount = float(transaction.amount)
        dest = transaction.country_destination or 'FRA'
        hour = transaction.transaction_date.hour
        factors_text = ' '.join(factors).lower()
        
        if amount >= 10000 and dest in HIGH_RISK_COUNTRIES and hour in SUSPICIOUS_HOURS:
            logger.warning("   🚨 BOOSTER ACTIF: Combo critique (montant + pays + nuit)")
            score *= 1.5
            factors.append("ALERTE MAXIMALE: Combinaison critique detectee!")
        
        if 'nouveau' in factors_text and amount >= 5000 and dest not in ['FRA', 'DEU', 'BEL', 'ESP', 'ITA']:
            logger.warning("   ⚠️ BOOSTER ACTIF: Premier transfert international significatif")
            score *= 1.3
            factors.append("RISQUE COMBINE: Premier transfert international significatif")
        
        if 'structuration' in factors_text and dest in HIGH_RISK_COUNTRIES:
            logger.warning("   🚨 BOOSTER ACTIF: Structuration vers pays a risque")
            score *= 1.4
            factors.append("ALERTE BLANCHIMENT: Structuration vers pays a risque")
        
        logger.info(f"   Score apres boosters: {score:.1f}/100")
        return score
    
    def _get_risk_level(self, score: float) -> str:
        if score >= 85:
            return 'critical'
        elif score >= 70:
            return 'high'
        elif score >= 50:
            return 'medium'
        elif score >= 30:
            return 'low'
        return 'minimal'
    
    def get_model_status(self) -> dict:
        return {
            "model_loaded": self.model is not None,
            "scaler_loaded": self.scaler is not None,
            "model_path": self.model_path,
            "threshold": self.threshold,
        }


# Instance singleton
fraud_detection_service = FraudDetectionService()
