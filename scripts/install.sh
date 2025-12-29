#!/bin/bash

# ============================================
# BPCE Fraud Detection Platform - Installation Script
# ============================================

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  BPCE Fraud Detection Platform - Installation             ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check prerequisites
echo ""
echo "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_status "Docker is installed"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_status "Docker Compose is installed"

# Check if Ollama is running (optional)
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    print_status "Ollama is running"
    OLLAMA_STATUS="connected"
else
    print_warning "Ollama is not running. LLM explanations will use fallback mode."
    print_warning "To enable AI explanations, install Ollama and run: ollama pull mistral:7b-instruct"
    OLLAMA_STATUS="not_connected"
fi

# Create .env file if not exists
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
    print_status ".env file created"
else
    print_status ".env file already exists"
fi

# Build and start services
echo ""
echo "Building and starting services..."
echo "This may take a few minutes on first run..."
echo ""

docker-compose up -d --build

# Wait for services to be ready
echo ""
echo "Waiting for services to start..."
sleep 10

# Check if backend is healthy
echo "Checking backend health..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        print_status "Backend is healthy"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "  Waiting for backend... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "Backend failed to start. Check logs with: docker-compose logs backend"
    exit 1
fi

# Seed database with sample data
echo ""
echo "Seeding database with sample transactions..."
docker-compose exec -T backend python scripts/seed.py -n 500

# Train the ML model
echo ""
echo "Training fraud detection model..."
docker-compose exec -T backend python scripts/train_model.py

# Final status
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Installation Complete!                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Services running:"
echo "  • Frontend:    http://localhost:4200"
echo "  • Backend API: http://localhost:8000"
echo "  • API Docs:    http://localhost:8000/docs"
echo "  • Adminer:     http://localhost:8080"
echo ""
echo "Default credentials:"
echo "  • Admin:    admin@bpce.fr / Admin123!"
echo "  • Analyst:  analyst@bpce.fr / Admin123!"
echo ""
echo "Database (Adminer):"
echo "  • Server:   postgres"
echo "  • Username: fraudadmin"
echo "  • Password: SecurePass123!"
echo "  • Database: fraud_detection"
echo ""

if [ "$OLLAMA_STATUS" == "not_connected" ]; then
    echo "⚠️  Note: Ollama is not running. For AI-powered explanations:"
    echo "    1. Install Ollama: https://ollama.ai"
    echo "    2. Run: ollama pull mistral:7b-instruct"
    echo "    3. Restart the backend: docker-compose restart backend"
    echo ""
fi

echo "Useful commands:"
echo "  • View logs:       docker-compose logs -f"
echo "  • Stop services:   docker-compose down"
echo "  • Restart:         docker-compose restart"
echo "  • Reset database:  docker-compose down -v && docker-compose up -d"
echo ""
print_status "Happy fraud hunting! 🔍"
