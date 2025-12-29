-- ============================================
-- FRAUD DETECTION PLATFORM - DATABASE SCHEMA
-- PostgreSQL 15+
-- ============================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'analyst' CHECK (role IN ('analyst', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche par email
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- TABLE: transactions
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_ref VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    sender_account VARCHAR(34) NOT NULL,
    receiver_account VARCHAR(34) NOT NULL,
    sender_name VARCHAR(255),
    receiver_name VARCHAR(255),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('virement', 'prelevement', 'carte', 'retrait', 'depot')),
    channel VARCHAR(50) DEFAULT 'web' CHECK (channel IN ('web', 'mobile', 'agence', 'atm', 'api')),
    country_origin VARCHAR(3),
    country_destination VARCHAR(3),
    ip_address VARCHAR(45),
    device_id VARCHAR(255),
    merchant_category VARCHAR(100),
    description TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Fraud detection fields
    fraud_score INTEGER CHECK (fraud_score >= 0 AND fraud_score <= 100),
    is_suspicious BOOLEAN DEFAULT FALSE,
    is_confirmed_fraud BOOLEAN DEFAULT FALSE,
    analysis_date TIMESTAMP WITH TIME ZONE,
    ai_explanation TEXT,
    
    -- Review fields
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'analyzed', 'reviewed', 'confirmed_fraud', 'cleared'))
);

-- Index pour recherche et performance
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_suspicious ON transactions(is_suspicious) WHERE is_suspicious = TRUE;
CREATE INDEX idx_transactions_fraud_score ON transactions(fraud_score DESC);
CREATE INDEX idx_transactions_ref ON transactions(transaction_ref);

-- ============================================
-- TABLE: audit_logs
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour audit
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- TABLE: fraud_alerts
-- ============================================
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour alertes
CREATE INDEX idx_fraud_alerts_transaction ON fraud_alerts(transaction_id);
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX idx_fraud_alerts_unack ON fraud_alerts(is_acknowledged) WHERE is_acknowledged = FALSE;

-- ============================================
-- TABLE: model_versions
-- ============================================
CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    metrics JSONB,
    is_active BOOLEAN DEFAULT FALSE,
    trained_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour modèles
CREATE INDEX idx_model_versions_active ON model_versions(is_active) WHERE is_active = TRUE;

-- ============================================
-- FUNCTION: Update timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT ADMIN USER
-- Password: Admin123! (hashed with bcrypt)
-- ============================================
INSERT INTO users (email, hashed_password, full_name, role) VALUES
    ('admin@bpce.fr', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G4o/gQ1cLdm3TS', 'Administrateur BPCE', 'admin'),
    ('analyst@bpce.fr', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G4o/gQ1cLdm3TS', 'Analyste Fraude', 'analyst')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- VIEW: Dashboard statistics
-- ============================================
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT 
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE is_suspicious = TRUE) as suspicious_count,
    COUNT(*) FILTER (WHERE is_confirmed_fraud = TRUE) as confirmed_fraud_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_review,
    AVG(fraud_score) FILTER (WHERE fraud_score IS NOT NULL) as avg_fraud_score,
    SUM(amount) FILTER (WHERE is_confirmed_fraud = TRUE) as total_fraud_amount,
    DATE(transaction_date) as transaction_day
FROM transactions
GROUP BY DATE(transaction_date)
ORDER BY transaction_day DESC;

-- ============================================
-- VIEW: Recent alerts
-- ============================================
CREATE OR REPLACE VIEW v_recent_alerts AS
SELECT 
    fa.id,
    fa.alert_type,
    fa.severity,
    fa.message,
    fa.is_acknowledged,
    fa.created_at,
    t.transaction_ref,
    t.amount,
    t.fraud_score
FROM fraud_alerts fa
JOIN transactions t ON fa.transaction_id = t.id
WHERE fa.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY fa.created_at DESC;
