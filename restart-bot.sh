#!/bin/bash

# Script to safely restart the Telegram bot
# This ensures only one instance is running at a time

echo "🤖 Telegram Bot Restart Script"
echo "=============================="

# Stop any running containers
echo "📦 Stopping existing containers..."
docker-compose down

# Wait a moment to ensure everything is stopped
echo "⏳ Waiting for services to stop..."
sleep 3

# Remove any orphaned containers
echo "🧹 Cleaning up orphaned containers..."
docker-compose down --remove-orphans

# Start fresh
echo "🚀 Starting services..."
docker-compose up -d

# Show logs
echo "📋 Showing logs (Ctrl+C to exit)..."
docker-compose logs -f app
