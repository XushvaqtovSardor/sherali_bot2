#!/bin/bash

echo "======================================"
echo "🚀 Digital Ocean Deployment Script"
echo "======================================"
echo ""

echo "⚠️  IMPORTANT: Network Mode Configuration"
echo "-------------------------------------"
echo "This bot now uses network_mode: 'host' for better connectivity."
echo ""
echo "If using host mode, update your .env file:"
echo "  DATABASE_URL=\"postgresql://postgres:sheralibot@localhost:5435/sherali_datadb\""
echo ""
echo "If you prefer bridge mode, edit docker-compose.yml:"
echo "  - Comment out: network_mode: \"host\""
echo "  - Uncomment: dns, extra_hosts, sysctls sections"
echo "  - Change DATABASE_URL to use 'db' instead of 'localhost'"
echo ""
read -p "Press Enter to continue with deployment..."

echo ""
echo "📦 Step 1: Stopping existing containers..."
docker-compose down

echo ""
echo "🧹 Step 2: Cleaning Docker cache..."
docker system prune -f

echo ""
echo "🔨 Step 3: Building image (this may take 5-10 minutes)..."
docker-compose build --no-cache

echo ""
echo "🔍 Step 4: Testing network connectivity..."
docker-compose run --rm app sh -c "ping -c 2 8.8.8.8 && nslookup tsue.edupage.org 8.8.8.8"

echo ""
echo "🚀 Step 5: Starting containers..."
docker-compose up -d

echo ""
echo "📋 Step 6: Showing logs (Ctrl+C to exit)..."
echo "Wait for 'Browser initialized successfully' message..."
docker-compose logs -f app
