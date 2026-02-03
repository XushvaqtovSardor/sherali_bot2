#!/bin/sh

echo "🔍 Network Diagnostics"
echo "====================="
echo ""

echo "1. DNS Resolution Test:"
nslookup tsue.edupage.org || echo "❌ DNS resolution failed"
echo ""

echo "2. Ping Test:"
ping -c 3 tsue.edupage.org || echo "❌ Ping failed"
echo ""

echo "3. HTTP Connection Test:"
curl -I --connect-timeout 10 https://tsue.edupage.org || echo "❌ HTTP connection failed"
echo ""

echo "4. Chrome/Chromium Check:"
which chromium-browser chromium google-chrome || echo "⚠️ Chrome not found in PATH"
chromium-browser --version || chromium --version || google-chrome --version || echo "❌ Chrome not installed"
echo ""

echo "5. DNS Settings:"
cat /etc/resolv.conf
echo ""

echo "6. Network Interfaces:"
ip addr show || ifconfig
echo ""

echo "====================="
echo "✅ Diagnostics Complete"
