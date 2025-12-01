#!/bin/bash

# Script to check bot status and identify conflicts

echo "🔍 Checking Bot Status"
echo "====================="

# Check if container is running
echo ""
echo "📦 Docker Container Status:"
docker-compose ps

echo ""
echo "🔍 Checking for running bot instances:"
docker ps --filter "name=timetable_bot" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📊 Recent logs:"
docker-compose logs --tail=50 app

echo ""
echo "💡 To stop all instances: docker-compose down"
echo "💡 To restart safely: ./restart-bot.sh"
