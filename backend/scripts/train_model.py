#!/usr/bin/env python3
"""
Training script for the IsolationForest fraud detection model
Trains on existing transactions in the database
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import argparse
from datetime import datetime

from app.database import SessionLocal
from app.models.transaction import Transaction
from app.services.fraud_detection import fraud_detection_service


def train_model(min_samples: int = 50):
    """
    Train the fraud detection model on existing transactions
    
    Args:
        min_samples: Minimum number of transactions required for training
    """
    print("🤖 Training Fraud Detection Model")
    print("=" * 50)
    
    db = SessionLocal()
    
    try:
        # Get all transactions
        transactions = db.query(Transaction).all()
        total = len(transactions)
        
        print(f"📊 Found {total} transactions in database")
        
        if total < min_samples:
            print(f"❌ Need at least {min_samples} transactions to train the model")
            print(f"   Run 'python scripts/seed.py' first to generate sample data")
            return False
        
        # Train the model
        print(f"\n🔧 Training IsolationForest model...")
        start_time = datetime.now()
        
        result = fraud_detection_service.train_model(transactions)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print(f"\n✅ Training complete!")
        print(f"   Samples trained: {result['samples_trained']}")
        print(f"   Model saved to: {result['model_path']}")
        print(f"   Training time: {duration:.2f} seconds")
        
        # Test the model on a few transactions
        print(f"\n🧪 Testing model on sample transactions...")
        test_samples = transactions[:5]
        
        for trans in test_samples:
            score, suspicious, factors = fraud_detection_service.analyze_transaction(trans)
            status = "⚠️ SUSPICIOUS" if suspicious else "✅ Normal"
            print(f"   {trans.transaction_ref}: Score={score}, {status}")
        
        return True
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        raise
    finally:
        db.close()


def show_model_status():
    """Display current model status"""
    status = fraud_detection_service.get_model_status()
    
    print("\n📊 Model Status")
    print("=" * 50)
    print(f"   Model loaded: {'✅ Yes' if status['model_loaded'] else '❌ No'}")
    print(f"   Scaler loaded: {'✅ Yes' if status['scaler_loaded'] else '❌ No'}")
    print(f"   Model path: {status['model_path']}")
    print(f"   Threshold: {status['threshold']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the fraud detection model")
    parser.add_argument("-m", "--min-samples", type=int, default=50, 
                        help="Minimum samples required for training")
    parser.add_argument("--status", action="store_true", 
                        help="Show model status only")
    
    args = parser.parse_args()
    
    if args.status:
        show_model_status()
    else:
        train_model(min_samples=args.min_samples)
        show_model_status()
