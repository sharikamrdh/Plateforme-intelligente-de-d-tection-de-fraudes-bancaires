#!/usr/bin/env python3
"""
Seed script to generate realistic fake transactions for testing
Generates 500 transactions with varied patterns including suspicious ones
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
import argparse

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.transaction import Transaction, TransactionType, TransactionChannel, TransactionStatus
from app.models.user import User
from app.utils.security import get_password_hash


# French first names and last names for realistic data
FIRST_NAMES = [
    "Jean", "Pierre", "Marie", "Sophie", "Thomas", "Julie", "Nicolas", "Camille",
    "François", "Isabelle", "Laurent", "Catherine", "Michel", "Nathalie", "Philippe",
    "Sandrine", "Christophe", "Véronique", "David", "Céline", "Olivier", "Anne",
    "Patrick", "Sylvie", "Bruno", "Martine", "Éric", "Christine", "Frédéric", "Aurélie"
]

LAST_NAMES = [
    "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand",
    "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David",
    "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier",
    "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Legrand"
]

# Merchant categories
MERCHANT_CATEGORIES = [
    "Supermarché", "Restaurant", "Station-service", "Pharmacie", "Vêtements",
    "Électronique", "Voyage", "Hôtel", "Transport", "Loisirs", "Santé",
    "Assurance", "Télécommunications", "Énergie", "Immobilier"
]

# Country codes
COUNTRIES = ["FRA", "DEU", "ESP", "ITA", "GBR", "BEL", "NLD", "CHE", "USA", "CHN", "RUS", "NGA"]
SAFE_COUNTRIES = ["FRA", "DEU", "ESP", "ITA", "GBR", "BEL", "NLD", "CHE"]
HIGH_RISK_COUNTRIES = ["RUS", "NGA", "CHN"]


def generate_iban(country: str = "FR") -> str:
    """Generate a fake but realistic IBAN"""
    if country == "FR":
        bank_code = str(random.randint(10000, 99999))
        branch_code = str(random.randint(10000, 99999))
        account_number = str(random.randint(10000000000, 99999999999))
        key = str(random.randint(10, 99))
        return f"FR76{bank_code}{branch_code}{account_number}{key}"
    return f"{country}00{random.randint(10**20, 10**21-1)}"


def generate_transaction_ref() -> str:
    """Generate unique transaction reference"""
    return f"TXN-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"


def random_name() -> str:
    """Generate a random French name"""
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def generate_normal_transaction(base_date: datetime) -> dict:
    """Generate a normal, non-suspicious transaction"""
    amount = round(random.uniform(10, 2000), 2)
    
    # Normal hours (8h-22h)
    hour = random.randint(8, 21)
    minute = random.randint(0, 59)
    
    # Mostly weekdays
    days_offset = random.randint(0, 30)
    trans_date = base_date - timedelta(days=days_offset)
    trans_date = trans_date.replace(hour=hour, minute=minute)
    
    return {
        "transaction_ref": generate_transaction_ref(),
        "amount": Decimal(str(amount)),
        "currency": "EUR",
        "sender_account": generate_iban("FR"),
        "receiver_account": generate_iban("FR"),
        "sender_name": random_name(),
        "receiver_name": random_name(),
        "transaction_type": random.choice([
            TransactionType.VIREMENT.value,
            TransactionType.CARTE.value,
            TransactionType.PRELEVEMENT.value
        ]),
        "channel": random.choice([
            TransactionChannel.WEB.value,
            TransactionChannel.MOBILE.value,
            TransactionChannel.AGENCE.value
        ]),
        "country_origin": "FRA",
        "country_destination": random.choice(SAFE_COUNTRIES),
        "ip_address": f"192.168.{random.randint(1,254)}.{random.randint(1,254)}",
        "device_id": f"DEV-{uuid4().hex[:12]}",
        "merchant_category": random.choice(MERCHANT_CATEGORIES),
        "description": random.choice([
            "Achat en ligne",
            "Virement mensuel",
            "Paiement facture",
            "Achat magasin",
            "Remboursement",
            "Transfert interne"
        ]),
        "transaction_date": trans_date,
        "status": TransactionStatus.PENDING.value
    }


def generate_suspicious_transaction(base_date: datetime) -> dict:
    """Generate a suspicious transaction with fraud indicators"""
    # Random suspicious pattern
    pattern = random.choice([
        "high_amount",
        "night_transaction",
        "international_high_risk",
        "round_amount",
        "weekend_large",
        "multiple_indicators"
    ])
    
    trans = generate_normal_transaction(base_date)
    
    if pattern == "high_amount":
        trans["amount"] = Decimal(str(round(random.uniform(8000, 50000), 2)))
        trans["description"] = "Virement urgent"
        
    elif pattern == "night_transaction":
        hour = random.choice([1, 2, 3, 4, 5, 23, 0])
        trans["transaction_date"] = trans["transaction_date"].replace(hour=hour)
        trans["amount"] = Decimal(str(round(random.uniform(500, 3000), 2)))
        
    elif pattern == "international_high_risk":
        trans["country_destination"] = random.choice(HIGH_RISK_COUNTRIES)
        trans["receiver_account"] = generate_iban(trans["country_destination"][:2])
        trans["amount"] = Decimal(str(round(random.uniform(2000, 15000), 2)))
        trans["description"] = "Transfert international"
        
    elif pattern == "round_amount":
        trans["amount"] = Decimal(str(random.choice([1000, 2000, 3000, 5000, 10000])))
        trans["description"] = "Virement"
        
    elif pattern == "weekend_large":
        # Force weekend
        days_to_saturday = (5 - trans["transaction_date"].weekday()) % 7
        trans["transaction_date"] = trans["transaction_date"] + timedelta(days=days_to_saturday)
        trans["amount"] = Decimal(str(round(random.uniform(5000, 20000), 2)))
        
    elif pattern == "multiple_indicators":
        # Combine multiple suspicious factors
        trans["amount"] = Decimal(str(round(random.uniform(10000, 30000), 2)))
        trans["country_destination"] = random.choice(HIGH_RISK_COUNTRIES)
        hour = random.choice([2, 3, 4])
        trans["transaction_date"] = trans["transaction_date"].replace(hour=hour)
        trans["receiver_account"] = generate_iban(trans["country_destination"][:2])
        trans["description"] = "Transfert urgent"
    
    return trans


def seed_database(num_transactions: int = 500, suspicious_ratio: float = 0.15):
    """
    Seed database with fake transactions
    
    Args:
        num_transactions: Total number of transactions to generate
        suspicious_ratio: Ratio of suspicious transactions (default 15%)
    """
    print(f"🌱 Seeding database with {num_transactions} transactions...")
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if users exist, create if not
        admin = db.query(User).filter(User.email == "admin@bpce.fr").first()
        if not admin:
            admin = User(
                email="admin@bpce.fr",
                hashed_password=get_password_hash("Admin123!"),
                full_name="Administrateur BPCE",
                role="admin"
            )
            db.add(admin)
            print("✅ Admin user created")
        
        analyst = db.query(User).filter(User.email == "analyst@bpce.fr").first()
        if not analyst:
            analyst = User(
                email="analyst@bpce.fr",
                hashed_password=get_password_hash("Admin123!"),
                full_name="Analyste Fraude",
                role="analyst"
            )
            db.add(analyst)
            print("✅ Analyst user created")
        
        db.commit()
        
        # Generate transactions
        base_date = datetime.now()
        num_suspicious = int(num_transactions * suspicious_ratio)
        num_normal = num_transactions - num_suspicious
        
        transactions = []
        
        # Generate normal transactions
        print(f"📝 Generating {num_normal} normal transactions...")
        for _ in range(num_normal):
            trans_data = generate_normal_transaction(base_date)
            transactions.append(Transaction(**trans_data))
        
        # Generate suspicious transactions
        print(f"⚠️ Generating {num_suspicious} suspicious transactions...")
        for _ in range(num_suspicious):
            trans_data = generate_suspicious_transaction(base_date)
            transactions.append(Transaction(**trans_data))
        
        # Shuffle and insert
        random.shuffle(transactions)
        
        print("💾 Inserting transactions into database...")
        for i, trans in enumerate(transactions):
            db.add(trans)
            if (i + 1) % 100 == 0:
                db.commit()
                print(f"   Inserted {i + 1}/{num_transactions}...")
        
        db.commit()
        
        # Print statistics
        total = db.query(Transaction).count()
        print(f"\n✅ Seeding complete!")
        print(f"📊 Total transactions in database: {total}")
        
        # Show sample
        print("\n📋 Sample transactions:")
        samples = db.query(Transaction).limit(5).all()
        for s in samples:
            print(f"   {s.transaction_ref}: {s.amount} {s.currency} - {s.transaction_type}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def clear_transactions():
    """Clear all transactions from database"""
    db = SessionLocal()
    try:
        count = db.query(Transaction).delete()
        db.commit()
        print(f"🗑️ Deleted {count} transactions")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed database with fake transactions")
    parser.add_argument("-n", "--num", type=int, default=500, help="Number of transactions")
    parser.add_argument("-s", "--suspicious", type=float, default=0.15, help="Ratio of suspicious transactions")
    parser.add_argument("--clear", action="store_true", help="Clear existing transactions first")
    
    args = parser.parse_args()
    
    if args.clear:
        clear_transactions()
    
    seed_database(num_transactions=args.num, suspicious_ratio=args.suspicious)
