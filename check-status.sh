#!/bin/bash

echo "🔍 LOYIHA HOLATI TEKSHIRUVI"
echo "================================"
echo ""

echo "📊 1. Database ulanishi (Neon PostgreSQL):"
echo "   URL: $(echo $DATABASE_URL | sed 's/:[^@]*@/:***@/')"

# Test database connection
if command -v psql &> /dev/null; then
    echo "   Testing connection..."
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as user_count FROM users;" 2>&1 | head -5
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as cache_count FROM jadval_cache;" 2>&1 | head -5
else
    echo "   ⚠️  psql o'rnatilmagan, database tekshirib bo'lmadi"
fi

echo ""
echo "📦 2. Redis ulanishi:"
echo "   URL: $(echo $REDIS_URL | sed 's/:[^@]*@/:***@/')"

if command -v redis-cli &> /dev/null; then
    echo "   Testing connection..."
    redis-cli -u "$REDIS_URL" PING 2>&1
    redis-cli -u "$REDIS_URL" DBSIZE 2>&1
else
    echo "   ⚠️  redis-cli o'rnatilmagan"
fi

echo ""
echo "☁️  3. Supabase Storage:"
echo "   URL: $SUPABASE_URL"
echo "   Bucket: screenshots"
echo "   ℹ️  Supabase dashboardga kiring: https://app.supabase.com"

echo ""
echo "🤖 4. Bot holati:"
echo "   Bot Token: ${BOT_TOKEN:0:10}..."
echo "   Admin ID: $ADMIN_ID"

echo ""
echo "📝 5. Tavsiyalar:"
echo "   • Telegramda botga /status yuboring"
echo "   • Supabase dashboard'da screenshots bucket'ini tekshiring"
echo "   • Neon dashboard'da database metrics'ni ko'ring"
echo ""
echo "🔗 Dashboard Links:"
echo "   • Supabase: https://app.supabase.com/project/hakejpynewtzcwgzdsyw"
echo "   • Neon: https://console.neon.tech"
echo "   • Redis Labs: https://app.redislabs.com"
