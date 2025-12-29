# 🏦 BPCE Fraud Detection Platform

> Plateforme intelligente de détection de fraude bancaire utilisant l'IA (IsolationForest + LLM Mistral)

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/Python-3.11-green)
![Angular](https://img.shields.io/badge/Angular-17-red)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![License](https://img.shields.io/badge/license-MIT-gray)

---

## 📋 Table des matières

- [Présentation](#-présentation)
- [Fonctionnalités](#-fonctionnalités)
- [Architecture](#-architecture)
- [Technologies](#-technologies)
- [Installation](#-installation)
- [Utilisation](#-utilisation)
- [API Endpoints](#-api-endpoints)
- [Démonstration](#-démonstration)
- [Auteur](#-auteur)

---

## 🎯 Présentation

Cette plateforme simule un **système de détection de fraude bancaire** tel qu'utilisé dans les services Conformité et AML (Anti-Money Laundering) des grandes banques comme BPCE.

### Objectifs

1. **Détecter automatiquement** les transactions suspectes via un modèle d'IA (IsolationForest)
2. **Expliquer les décisions** de l'IA de manière compréhensible (Explainable AI)
3. **Permettre aux analystes** de gérer les alertes et prendre des décisions

### Cas d'usage réel

| Transaction | Montant | Pays | Heure | Score IA | Décision |
|-------------|---------|------|-------|----------|----------|
| Virement local | 45€ | France | 14h | 5% | ✅ Normal |
| Retrait international | 2 300€ | Nigeria | 03h12 | 92% | 🚨 Alerte |

---

## ✨ Fonctionnalités

### 🤖 Détection IA (Rôle n°1)

L'IA analyse chaque transaction selon **5 critères pondérés** :

| Critère | Poids | Description |
|---------|-------|-------------|
| **Modèle ML** | 35% | IsolationForest détecte les comportements anormaux |
| **Montant** | 25% | Seuils de vigilance (10k€, 20k€, 50k€), détection de structuration |
| **Géographie** | 20% | Liste GAFI des pays à risque (Nigeria=95%, Russie=85%...) |
| **Horaire** | 10% | Transactions nocturnes (0h-6h) = suspect |
| **Bénéficiaire** | 10% | Nouveau bénéficiaire, mots-clés suspects (crypto, offshore...) |

### 🧠 Explainable AI (Rôle n°2)

Chaque alerte génère une **explication professionnelle** :

```
ALERTE CRITIQUE (Score 92/100): Cette transaction de 2 300 EUR 
présente un niveau de risque TRÈS ÉLEVÉ.

La destination (Nigeria) figure sur la liste des pays à haut risque GAFI.
L'opération a été effectuée à 3h, une heure nocturne très inhabituelle.
Le bénéficiaire est nouveau sur ce compte.

ACTION REQUISE: BLOQUER immédiatement. Alerter le responsable Fraude.
```

### 🎛️ Actions de l'analyste

| Action | Description | Statut résultant |
|--------|-------------|------------------|
| 🚫 **Bloquer** | Bloque immédiatement le virement | `confirmed_fraud` |
| 🎫 **Ticket Fraude** | Ouvre un ticket d'investigation | `under_investigation` |
| 📞 **Appeler Client** | Demande de vérification téléphonique | `pending_call` |
| ✅ **Approuver** | Marque comme fausse alerte | `cleared` |

### 📊 Dashboard

- Statistiques en temps réel (transactions, alertes, fraudes confirmées)
- Graphique d'évolution sur 7 jours
- Transactions récentes avec indicateurs de risque
- KPIs : taux de détection, montant des fraudes bloquées

### 👥 Gestion des utilisateurs

- **Admin** : Accès complet, gestion des utilisateurs, configuration
- **Analyste** : Analyse des transactions, actions sur les alertes

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Angular 17)                     │
│  ┌─────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────────┐ │
│  │  Login  │  │  Dashboard   │  │Transactions│ │   Settings    │ │
│  └─────────┘  └──────────────┘  └──────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  Auth API   │  │ Transactions API │  │    Fraud Engine     │  │
│  │  (JWT)      │  │  (CRUD + Actions)│  │  ┌───────────────┐  │  │
│  └─────────────┘  └─────────────────┘  │  │ IsolationForest│  │  │
│                                         │  └───────────────┘  │  │
│  ┌─────────────────────────────────┐   │  ┌───────────────┐  │  │
│  │         Audit Logger            │   │  │  LLM Mistral  │  │  │
│  └─────────────────────────────────┘   │  └───────────────┘  │  │
│                                         └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                          │
│  ┌───────────┐  ┌───────────────┐  ┌─────────────────────────┐  │
│  │   users   │  │  transactions │  │      audit_logs         │  │
│  └───────────┘  └───────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technologies

### Backend
- **FastAPI** - Framework API Python haute performance
- **SQLAlchemy** - ORM pour PostgreSQL
- **Scikit-learn** - Modèle IsolationForest
- **Ollama + Mistral 7B** - LLM pour les explications (optionnel)
- **JWT** - Authentification sécurisée
- **Pydantic** - Validation des données

### Frontend
- **Angular 17** - Framework avec Signals et nouvelle syntaxe @if/@for
- **SCSS** - Styles avec thème sombre
- **RxJS** - Programmation réactive

### Base de données
- **PostgreSQL 15** - Base relationnelle

### DevOps (optionnel)
- **Docker & Docker Compose** - Conteneurisation
- **Nginx** - Reverse proxy

---

## 🚀 Installation

### Prérequis

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- (Optionnel) Ollama pour le LLM

### 1. Base de données

```bash
psql -d postgres

CREATE DATABASE fraud_detection;
CREATE USER fraudadmin WITH PASSWORD 'SecurePass123!';
GRANT ALL PRIVILEGES ON DATABASE fraud_detection TO fraudadmin;
ALTER USER fraudadmin WITH SUPERUSER;
\c fraud_detection
GRANT ALL ON SCHEMA public TO fraudadmin;
\q
```

### 2. Créer les tables

```bash
psql -U fraudadmin -d fraud_detection
```

Exécuter le script SQL complet (voir `database/init.sql` ou la documentation).

### 3. Backend

```bash
cd backend

# Créer l'environnement virtuel
python3.11 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Créer le dossier models
mkdir -p models

# Variables d'environnement
export DATABASE_URL='postgresql://fraudadmin:SecurePass123!@localhost:5432/fraud_detection'
export SECRET_KEY='your-super-secret-key-change-in-production-min-32-chars'
export MODEL_PATH='./models/isolation_forest.joblib'

# Créer les utilisateurs
python << 'EOF'
from app.database import SessionLocal
from app.models.user import User
from app.utils.security import get_password_hash
db = SessionLocal()
admin = User(email="admin@bpce.fr", hashed_password=get_password_hash("Admin123!"), full_name="Admin BPCE", role="admin")
analyst = User(email="analyst@bpce.fr", hashed_password=get_password_hash("Admin123!"), full_name="Analyste Fraude", role="analyst")
db.add(admin)
db.add(analyst)
db.commit()
db.close()
print("✅ Utilisateurs créés!")
EOF

# Générer les données de test
python scripts/seed.py -n 500

# Entraîner le modèle
python scripts/train_model.py

# Créer les données de démonstration (fraudes)
python scripts/create_demo_data.py

# Lancer le serveur
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm start
```

---

## 💻 Utilisation

### Accès

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:8000 |
| Documentation API | http://localhost:8000/docs |

### Identifiants de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@bpce.fr | Admin123! |
| Analyste | analyst@bpce.fr | Admin123! |

### Workflow typique

1. **Connexion** → Se connecter avec un compte analyste
2. **Dashboard** → Voir les statistiques et alertes récentes
3. **Transactions** → Filtrer les transactions suspectes
4. **Analyse** → Cliquer sur "Analyser" pour obtenir le score IA
5. **Action** → Bloquer / Créer ticket / Appeler client / Approuver

---

## 🔌 API Endpoints

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/login` | Connexion (retourne JWT) |
| POST | `/auth/register` | Inscription |
| GET | `/auth/me` | Profil utilisateur |

### Transactions

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/transactions` | Liste avec filtres et pagination |
| GET | `/transactions/{id}` | Détails d'une transaction |
| POST | `/transactions` | Créer une transaction |
| POST | `/transactions/{id}/analyze` | Analyser (score IA + explication) |
| POST | `/transactions/{id}/block` | 🚫 Bloquer |
| POST | `/transactions/{id}/ticket` | 🎫 Créer un ticket fraude |
| POST | `/transactions/{id}/call-client` | 📞 Demander un appel client |
| POST | `/transactions/{id}/approve` | ✅ Approuver (fausse alerte) |

### Statistiques

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/transactions/stats` | Statistiques globales |
| GET | `/transactions/daily-stats` | Stats par jour (graphique) |

---

## 🎬 Démonstration

### Scénario pour entretien

1. **Présenter le Dashboard**
   - Montrer les KPIs en temps réel
   - Expliquer le graphique d'évolution

2. **Analyser une transaction suspecte**
   - Filtrer par "Suspects uniquement"
   - Cliquer sur "Analyser"
   - Montrer le score IA (ex: 92%)
   - Lire l'explication générée

3. **Effectuer une action**
   - Créer un ticket fraude → Montrer le numéro généré
   - Ou bloquer la transaction → Statut change en "Fraude confirmée"

4. **Expliquer la technique**
   - IsolationForest : détection d'anomalies non supervisée
   - Scoring multi-critères : montant, pays, heure, bénéficiaire
   - Explainable AI : conformité AML/KYC

### Points clés à mentionner

- ✅ Détection automatique des comportements suspects
- ✅ Scoring basé sur les règles GAFI (pays à risque)
- ✅ Explainable AI pour la conformité réglementaire
- ✅ Workflow complet de gestion des alertes
- ✅ Audit trail pour la traçabilité

---

## 📁 Structure du projet

```
fraud-platform/
├── backend/
│   ├── app/
│   │   ├── models/          # Modèles SQLAlchemy
│   │   ├── routers/         # Endpoints API
│   │   ├── schemas/         # Schémas Pydantic
│   │   ├── services/        # Logique métier (fraud_detection, llm_explainer)
│   │   ├── middleware/      # Audit logging
│   │   └── utils/           # Utilitaires (auth, security)
│   ├── scripts/             # Scripts de données
│   ├── models/              # Modèles ML sauvegardés
│   └── requirements.txt
├── frontend/
│   ├── src/app/
│   │   ├── core/            # Services, guards, interceptors
│   │   ├── pages/           # Composants de pages
│   │   └── shared/          # Composants partagés
│   └── package.json
├── database/
│   └── init.sql             # Script d'initialisation
├── docker-compose.yml       # Déploiement Docker
└── README.md
```

---

## 👨‍💻 Auteur

Projet développé dans le cadre d'une démonstration de compétences en **Data Science** et **Développement Full-Stack** pour un entretien chez **BPCE**.

### Compétences démontrées

- 🐍 **Python** : FastAPI, SQLAlchemy, Scikit-learn
- 🅰️ **Angular** : Version 17, Signals, RxJS
- 🗄️ **PostgreSQL** : Modélisation, requêtes complexes
- 🤖 **Machine Learning** : IsolationForest, détection d'anomalies
- 🧠 **LLM** : Intégration Mistral pour l'Explainable AI
- 🔐 **Sécurité** : JWT, hashing bcrypt, validation
- 📊 **Data Visualization** : Dashboards, KPIs

---

## 📄 Licence

MIT License - Libre d'utilisation pour tout usage.
