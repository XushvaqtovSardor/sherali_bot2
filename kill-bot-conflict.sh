#!/bin/bash

# 🛑 Kill Conflicting Bot Instance Script
# Use this when you get "409 Conflict" error

echo "🔍 Checking for bot conflicts..."

# Method 1: Webhook cleanup (forces Telegram to release the bot)
echo "📞 Deleting webhook to release bot lock..."

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"

echo ""
echo "⏳ Waiting 5 seconds for Telegram to release the bot..."
sleep 5

# Method 2: Check if webhook is cleared
echo "🔍 Checking webhook status..."
curl -X GET "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

echo ""
echo ""
echo "✅ Bot should be released now. Restart your bot service."
echo ""
echo "If still getting 409 error:"
echo "1. Wait 2-3 minutes (Telegram cooldown period)"
echo "2. Make sure no other bot instances are running (check PM2, Docker, etc.)"
echo "3. Run this script again"
