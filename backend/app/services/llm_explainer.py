"""
LLM Explainer Service using Ollama (Mistral)
Explainable AI - Genere des explications claires et professionnelles pour les analystes
"""
import httpx
import json
from typing import List, Optional
from loguru import logger
from decimal import Decimal

from app.config import settings
from app.models.transaction import Transaction


# Pays a haut risque pour les explications
HIGH_RISK_COUNTRIES_NAMES = {
    'NGA': 'Nigeria', 'RUS': 'Russie', 'IRN': 'Iran', 'PRK': 'Coree du Nord',
    'AFG': 'Afghanistan', 'SYR': 'Syrie', 'YEM': 'Yemen', 'PAK': 'Pakistan',
    'MMR': 'Myanmar', 'VEN': 'Venezuela', 'LBY': 'Libye', 'SOM': 'Somalie'
}


class LLMExplainerService:
    """
    Service d'explication des fraudes utilisant Mistral via Ollama
    Implemente l'Explainable AI pour la conformite bancaire
    """
    
    def __init__(self):
        self.ollama_host = settings.ollama_host
        self.model = settings.ollama_model
        self.timeout = 60.0
    
    async def explain_transaction(
        self,
        transaction: Transaction,
        fraud_score: int,
        risk_factors: List[str]
    ) -> str:
        """
        Genere une explication en langage naturel pour une analyse de fraude
        """
        risk_level = self._get_risk_level(fraud_score)
        factors_text = "\n".join(f"- {f}" for f in risk_factors) if risk_factors else "Aucun facteur majeur"
        
        prompt = f"""Tu es un analyste senior en detection de fraude bancaire chez BPCE.
Analyse cette transaction et fournis une explication PROFESSIONNELLE pour l'equipe Conformite.

=== TRANSACTION ===
Reference: {transaction.transaction_ref}
Montant: {transaction.amount} {transaction.currency}
Type: {transaction.transaction_type}
Canal: {transaction.channel}
Date/Heure: {transaction.transaction_date.strftime('%d/%m/%Y a %H:%M')}
Expediteur: {transaction.sender_name or 'Non specifie'}
Beneficiaire: {transaction.receiver_name or 'Non specifie'}
Pays origine: {transaction.country_origin or 'France'}
Pays destination: {transaction.country_destination or 'France'}
Motif: {transaction.description or 'Non specifie'}

=== ANALYSE IA ===
Score: {fraud_score}/100
Niveau: {risk_level}
Facteurs:
{factors_text}

Redige 4-5 phrases professionnelles:
1. Niveau de risque clair
2. Explication des 2-3 facteurs principaux
3. Contexte AML/KYC si pertinent
4. Recommandation precise

Reponds UNIQUEMENT avec l'explication."""

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.ollama_host}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "top_p": 0.9,
                            "num_predict": 400
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    explanation = result.get("response", "").strip()
                    logger.info(f"Explication LLM generee pour {transaction.transaction_ref}")
                    return explanation
                else:
                    logger.error(f"Erreur API Ollama: {response.status_code}")
                    return self._generate_fallback_explanation(
                        transaction, fraud_score, risk_level, risk_factors
                    )
                    
        except httpx.TimeoutException:
            logger.error("Timeout Ollama")
            return self._generate_fallback_explanation(
                transaction, fraud_score, risk_level, risk_factors
            )
        except httpx.ConnectError:
            logger.error(f"Connexion Ollama impossible: {self.ollama_host}")
            return self._generate_fallback_explanation(
                transaction, fraud_score, risk_level, risk_factors
            )
        except Exception as e:
            logger.error(f"Erreur LLM: {e}")
            return self._generate_fallback_explanation(
                transaction, fraud_score, risk_level, risk_factors
            )
    
    def _get_risk_level(self, score: int) -> str:
        """Convertit le score en niveau de risque"""
        if score >= 85:
            return "CRITIQUE"
        elif score >= 70:
            return "ELEVE"
        elif score >= 50:
            return "MOYEN"
        elif score >= 30:
            return "FAIBLE"
        return "MINIMAL"
    
    def _generate_fallback_explanation(
        self,
        transaction: Transaction,
        fraud_score: int,
        risk_level: str,
        risk_factors: List[str]
    ) -> str:
        """
        Genere une explication detaillee basee sur des regles quand le LLM est indisponible
        Format professionnel pour les analystes conformite
        """
        amount = float(transaction.amount)
        dest = transaction.country_destination or 'FRA'
        origin = transaction.country_origin or 'FRA'
        hour = transaction.transaction_date.hour
        day = transaction.transaction_date.weekday()
        receiver = transaction.receiver_name or 'Non specifie'
        
        # === INTRODUCTION ===
        if fraud_score >= 85:
            intro = f"ALERTE CRITIQUE (Score {fraud_score}/100): Cette transaction de {amount:,.0f} EUR presente un niveau de risque TRES ELEVE necessitant une intervention immediate."
        elif fraud_score >= 70:
            intro = f"ALERTE ELEVEE (Score {fraud_score}/100): Cette transaction de {amount:,.0f} EUR presente plusieurs indicateurs de risque significatifs necessitant verification."
        elif fraud_score >= 50:
            intro = f"VIGILANCE REQUISE (Score {fraud_score}/100): Cette transaction de {amount:,.0f} EUR presente des elements inhabituels meritant une attention particuliere."
        elif fraud_score >= 30:
            intro = f"RISQUE FAIBLE (Score {fraud_score}/100): Cette transaction de {amount:,.0f} EUR presente quelques points de vigilance mineurs."
        else:
            intro = f"TRANSACTION NORMALE (Score {fraud_score}/100): Cette transaction de {amount:,.0f} EUR ne presente pas d'anomalie significative."
        
        # === ANALYSE DES FACTEURS ===
        analysis = []
        
        # Montant
        if amount >= 50000:
            analysis.append(f"Le montant exceptionnel de {amount:,.0f} EUR depasse largement les seuils de vigilance AML et necessite une declaration Tracfin")
        elif amount >= 20000:
            analysis.append(f"Le montant de {amount:,.0f} EUR est significativement eleve et declenche une vigilance renforcee")
        elif amount >= 10000:
            analysis.append(f"Le montant de {amount:,.0f} EUR atteint le seuil de declaration reglementaire")
        elif 9000 <= amount <= 9999:
            analysis.append(f"Le montant de {amount:,.0f} EUR, juste sous le seuil de 10 000 EUR, pourrait indiquer une tentative de structuration")
        
        # Pays
        if dest in HIGH_RISK_COUNTRIES_NAMES:
            country_name = HIGH_RISK_COUNTRIES_NAMES[dest]
            analysis.append(f"La destination ({country_name}) figure sur la liste des pays a haut risque GAFI, necessitant une vigilance renforcee AML")
        elif dest != 'FRA' and dest != origin:
            analysis.append(f"Il s'agit d'un transfert international vers {dest}, ce qui augmente le niveau de surveillance requis")
        
        # Horaire
        if 0 <= hour <= 5:
            analysis.append(f"L'operation a ete effectuee a {hour}h, une heure nocturne tres inhabituelle pour une activite bancaire legitime")
        elif hour == 23:
            analysis.append(f"L'operation tardive ({hour}h) sort des habitudes transactionnelles standards")
        
        # Week-end
        if day >= 5 and amount > 5000:
            day_name = "samedi" if day == 5 else "dimanche"
            analysis.append(f"La transaction elevee effectuee un {day_name} constitue un comportement atypique")
        
        # Beneficiaire
        receiver_lower = receiver.lower()
        if any(kw in receiver_lower for kw in ['crypto', 'trading', 'forex', 'exchange']):
            analysis.append(f"Le beneficiaire '{receiver}' suggere une activite liee aux cryptomonnaies ou au trading, secteurs a risque eleve")
        elif any(kw in receiver_lower for kw in ['llc', 'fze', 'offshore', 'ltd']):
            analysis.append(f"La structure juridique du beneficiaire ({receiver}) presente des caracteristiques de societe ecran potentielle")
        
        # Ajouter les facteurs detectes non couverts
        for factor in risk_factors[:2]:
            if not any(keyword in factor.lower() for keyword in ['montant', 'pays', 'heure', 'nocturne', 'beneficiaire']):
                analysis.append(factor)
        
        # === RECOMMANDATION ===
        if fraud_score >= 85:
            recommendation = "ACTION REQUISE: BLOQUER la transaction immediatement. Alerter le responsable Fraude et le service Conformite. Contacter le client pour verification d'identite renforcee avant toute validation."
        elif fraud_score >= 70:
            recommendation = "ACTION REQUISE: SUSPENDRE la transaction en attente de verification. Contacter le client par telephone pour confirmer l'operation et documenter l'echange."
        elif fraud_score >= 50:
            recommendation = "SURVEILLANCE RECOMMANDEE: Marquer le compte pour surveillance renforcee. Analyser les transactions suivantes dans les 48h. Documenter dans le dossier client."
        elif fraud_score >= 30:
            recommendation = "VIGILANCE: Aucune action immediate necessaire. Enregistrer l'alerte dans l'historique pour analyse statistique ulterieure."
        else:
            recommendation = "Aucune action requise. Transaction dans les parametres normaux du profil client."
        
        # === ASSEMBLAGE ===
        explanation_parts = [intro]
        
        if analysis:
            explanation_parts.append(" ".join(analysis[:3]) + ".")
        
        explanation_parts.append(recommendation)
        
        return " ".join(explanation_parts)
    
    async def check_ollama_status(self) -> dict:
        """Verifie si Ollama est disponible"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.ollama_host}/api/tags")
                
                if response.status_code == 200:
                    data = response.json()
                    models = [m["name"] for m in data.get("models", [])]
                    model_available = any(self.model in m for m in models)
                    
                    return {
                        "status": "connected",
                        "host": self.ollama_host,
                        "model": self.model,
                        "model_available": model_available,
                        "available_models": models
                    }
                    
        except Exception as e:
            logger.warning(f"Verification Ollama echouee: {e}")
            
        return {
            "status": "disconnected",
            "host": self.ollama_host,
            "model": self.model,
            "model_available": False,
            "error": "Impossible de se connecter a Ollama"
        }


# Instance singleton
llm_explainer_service = LLMExplainerService()
