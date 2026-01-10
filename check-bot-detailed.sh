#!/bin/bash

echo "=========================================="
echo "🔍 Bot Status Checker"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check containers
echo "🐳 Docker Containers:"
echo "----------------------------------------"
docker ps -a --filter "name=timetable" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check if bot container is running
if [ "$(docker ps -q -f name=timetable_bot)" ]; then
    echo -e "${GREEN}✅ Bot container is running${NC}"
    
    # Check health
    echo ""
    echo "🏥 Health Check:"
    echo "----------------------------------------"
    HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Health endpoint responding${NC}"
        echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
    else
        echo -e "${RED}❌ Health endpoint not responding${NC}"
    fi
    
    echo ""
    echo "📊 Detailed Status:"
    echo "----------------------------------------"
    STATUS=$(curl -s http://localhost:3000/api/status 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "$STATUS" | jq . 2>/dev/null || echo "$STATUS"
    else
        echo -e "${RED}❌ Status endpoint not responding${NC}"
    fi
    
    echo ""
    echo "📝 Recent Logs (last 30 lines):"
    echo "----------------------------------------"
    docker logs --tail 30 timetable_bot
    
else
    echo -e "${RED}❌ Bot container is NOT running${NC}"
    echo ""
    echo "📝 Last container logs:"
    echo "----------------------------------------"
    docker logs --tail 50 timetable_bot 2>/dev/null || echo "No logs available"
fi

echo ""
echo "=========================================="
echo "💾 Resource Usage:"
echo "=========================================="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "=========================================="
echo "🔗 Useful Commands:"
echo "=========================================="
echo "View live logs:    docker logs -f timetable_bot"
echo "Restart bot:       docker-compose restart app"
echo "Stop all:          docker-compose down"
echo "Start all:         docker-compose up -d"
echo "Rebuild:           docker-compose up -d --build"
echo "=========================================="
