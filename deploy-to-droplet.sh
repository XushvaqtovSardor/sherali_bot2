#!/bin/bash

echo "=========================================="
echo "🚀 Deploy Bot to Digital Ocean Droplet"
echo "=========================================="
echo ""

# Configuration
SERVER_IP="142.93.22.81"
SERVER_USER="root"
SSH_KEY="~/.ssh/droplet_2"
REMOTE_DIR="/var/www/sherali_bot"
GIT_REPO="https://github.com/XushvaqtovSardor/sherali_bot2.git"
GIT_BRANCH="main"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📋 Deployment Configuration:"
echo "  Server: ${SERVER_IP}"
echo "  User: ${SERVER_USER}"
echo "  Directory: ${REMOTE_DIR}"
echo "  Git Repo: ${GIT_REPO}"
echo "  Branch: ${GIT_BRANCH}"
echo ""

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Step 1: Check Git status
echo "=========================================="
echo "📝 Step 1: Checking Git status..."
echo "=========================================="
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes!"
    echo "Please commit your changes before deploying."
    git status --short
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled"
        exit 1
    fi
fi
print_success "Git status checked"
echo ""

# Step 2: Push to Git
echo "=========================================="
echo "📤 Step 2: Pushing to Git repository..."
echo "=========================================="
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || print_info "No changes to commit"
git push origin ${GIT_BRANCH}
if [ $? -ne 0 ]; then
    print_error "Git push failed!"
    exit 1
fi
print_success "Code pushed to Git"
echo ""

# Step 3: Connect to server and deploy
echo "=========================================="
echo "🚀 Step 3: Deploying to server..."
echo "=========================================="

ssh -i ${SSH_KEY} ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
set -e

echo "=========================================="
echo "📍 Connected to server"
echo "=========================================="

# Check if directory exists
if [ ! -d "/var/www/sherali_bot" ]; then
    echo "📁 Creating project directory..."
    mkdir -p /var/www/sherali_bot
    cd /var/www/sherali_bot
    
    echo "📥 Cloning repository..."
    git clone https://github.com/XushvaqtovSardor/sherali_bot2.git .
else
    echo "📂 Project directory exists"
    cd /var/www/sherali_bot
    
    echo "🔄 Pulling latest changes..."
    git fetch origin
    git reset --hard origin/main
    git pull origin main
fi

echo ""
echo "=========================================="
echo "🛑 Stopping existing containers..."
echo "=========================================="
docker-compose down || echo "No containers to stop"

echo ""
echo "=========================================="
echo "🧹 Cleaning up Docker..."
echo "=========================================="
docker system prune -f

echo ""
echo "=========================================="
echo "🔨 Building Docker images..."
echo "=========================================="
docker-compose build --no-cache

echo ""
echo "=========================================="
echo "✅ Checking .env file..."
echo "=========================================="
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "🚨 IMPORTANT: Edit .env file with your actual values!"
    echo "Run: nano /var/www/sherali_bot/.env"
    echo ""
    exit 1
fi
echo "✅ .env file exists"

echo ""
echo "=========================================="
echo "🚀 Starting containers..."
echo "=========================================="
docker-compose up -d

echo ""
echo "⏳ Waiting 30 seconds for services to start..."
sleep 30

echo ""
echo "=========================================="
echo "🏥 Health Check..."
echo "=========================================="
HEALTH=$(curl -s http://localhost:3000/api/health || echo "failed")
if [ "$HEALTH" != "failed" ]; then
    echo "✅ Health check passed"
    echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
else
    echo "❌ Health check failed"
fi

echo ""
echo "=========================================="
echo "📊 Container Status:"
echo "=========================================="
docker-compose ps

echo ""
echo "=========================================="
echo "📝 Recent Logs:"
echo "=========================================="
docker logs --tail 30 timetable_bot

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETED!"
echo "=========================================="
echo ""
echo "🔗 Useful Commands:"
echo "  View logs:    docker logs -f timetable_bot"
echo "  Restart:      docker-compose restart app"
echo "  Stop:         docker-compose down"
echo "  Rebuild:      docker-compose up -d --build"
echo ""
echo "🏥 Health Check URLs:"
echo "  http://localhost:3000/api/health"
echo "  http://localhost:3000/api/status"
echo ""
echo "=========================================="

ENDSSH

if [ $? -ne 0 ]; then
    print_error "Deployment failed!"
    exit 1
fi

echo ""
print_success "Deployment completed successfully!"
echo ""
print_info "Bot is now running on: http://${SERVER_IP}:3000"
echo ""
    echo -e "${RED}❌ File copy failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Files copied successfully${NC}"
echo ""

# Step 3: Deploy on server
echo "🚀 Step 3: Deploying on server..."
echo "----------------------------------------"
ssh -i ${SSH_KEY} ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /var/www/sherali_bot

echo "📦 Stopping existing containers..."
docker-compose down

echo "🧹 Cleaning up..."
docker system prune -f

echo "🔨 Building new containers..."
docker-compose build

echo "🚀 Starting containers..."
docker-compose up -d

echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

echo "🏥 Checking health..."
curl -s http://localhost:3000/api/health | jq .

echo "📊 Container status:"
docker-compose ps

echo "📝 Recent logs:"
docker logs --tail 20 timetable_bot

ENDSSH

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "🔗 Check status:"
echo "  ssh -i ${SSH_KEY} ${SERVER_USER}@${SERVER_IP}"
echo "  cd ${REMOTE_DIR} && docker logs -f timetable_bot"
echo ""
echo "🏥 Health check:"
echo "  curl http://${SERVER_IP}:3000/api/health"
echo "=========================================="
