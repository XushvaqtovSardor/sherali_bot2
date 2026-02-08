#!/bin/sh

echo "🔍 Network Diagnostics"
echo "====================="
echo ""

echo "1. DNS Resolution Test:"
nslookup tsue.edupage.org 8.8.8.8 || echo "❌ DNS resolution failed"
echo ""

echo "2. Alternative DNS Test:"
nslookup tsue.edupage.org 1.1.1.1 || echo "❌ Alternative DNS failed"
echo ""

echo "3. Ping Google DNS (connectivity test):"
ping -c 3 8.8.8.8 || echo "❌ Basic connectivity failed"
echo ""

echo "4. HTTP Connection Test (with timeout):"
curl -I --connect-timeout 15 --max-time 30 https://tsue.edupage.org || echo "❌ HTTP connection failed"
echo ""

echo "5. Alternative HTTP Test:"
wget --spider --timeout=15 -T 30 https://tsue.edupage.org || echo "❌ Wget test failed"
echo ""

echo "6. Chrome/Chromium Check:"
which chromium-browser chromium google-chrome || echo "⚠️ Chrome not found in PATH"
chromium-browser --version 2>/dev/null || chromium --version 2>/dev/null || google-chrome --version 2>/dev/null || echo "❌ Chrome not installed"
echo ""

echo "7. DNS Settings:"
cat /etc/resolv.conf
echo ""

echo "8. Network Interfaces:"
ip addr show 2>/dev/null || ifconfig
echo ""

echo "9. Routing table:"
ip route 2>/dev/null || route -n
echo ""

echo "====================="
echo "✅ Diagnostics Complete"
