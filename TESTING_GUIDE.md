# Testing Guide - Sherali TG Bot

## ✅ Bajarilgan Ishlar

### 1. Environment Configuration
- ✅ `.env` fayli to'g'irlandi
- ✅ Redis URL to'g'ri formatga keltirildi
- ✅ PostgreSQL (Neon) ulanishi tasdiqlandi
- ✅ JWT_SECRET qo'shildi
- ✅ Cache duration 8 soatga o'zgartirildi (28800000ms)

### 2. Code Fixes
- ✅ BotService.ts to'liq qayta yozildi
- ✅ Redis error handling qo'shildi (Redis ishlamasa PostgreSQL ishlatadi)
- ✅ CacheService yangilandi - fallback logic bilan
- ✅ Screenshot processor PNG formatga o'tkazildi
- ✅ User service filter logic to'g'irlandi
- ✅ Logger service import path to'g'ireland

### 3. Build Status
- ✅ TypeScript kompil yatsiya muvaffaqiyatli
- ✅ Barcha dependencies o'rnatilgan
- ✅ Prisma client generate qilindi
- ✅ Database migr ations bajarildi

## 🔧 Qolgan Muammolar

### Redis Connection
Redis cloud service bilan bog'lanishda muammo bo'lishi mumkin:
```
REDIS_URL=redis://default:L6wr26N7JtVab2IWXMJWtgkhkq69ovhF@redis-16408.c91.us-east-1-3.ec2.cloud.redislabs.com:16408
```

**Solution**: Redis ishlamasa ham bot ishlaydigan qilib sozlangan (PostgreSQL-only mode).

### BullMQ Queue
Bull MQ Redis connection kerak. Redis mavjud bo'lmasa queue ishlamaydi.

**Temporary Solution**: Screenshot'lar to'g'ridan-to'g'ri olinadi (queue'siz).

## 🚀 Ishga Tushirish

### Option 1: Development Mode
```bash
cd /d/c_p/sherali_tg_bot
pnpm start:dev
```

### Option 2: Production Build
```bash
pnpm build
pnpm start:prod
```

### Option 3: Direct Node
```bash
node dist/main.js
```

## 📋 Test Checklist

### Database Tests
- [x] PostgreSQL connection works
- [x] Prisma migrations applied
- [x] User table exists
- [x] JadvalCache table exists

### Redis Tests (Optional)
- [ ] Redis cloud connection
- [ ] Cache SET/GET works
- [ ] Bull MQ queue functional

### Bot Functions
- [ ] `/start` command
- [ ] `/menu` command  
- [ ] `/status` command
- [ ] `/send` admin command
- [ ] Faculty selection
- [ ] Course selection
- [ ] Group selection
- [ ] Screenshot generation
- [ ] Screenshot caching
- [ ] Refresh button

### Screenshot System
- [ ] Puppeteer browser launches
- [ ] Page navigation works
- [ ] Screenshot captured to disk
- [ ] Path saved to database
- [ ] Cache expiration (8 hours)
- [ ] Refresh clears cache

## 🐛 Debugging

### Check if bot is running:
```bash
ps aux | grep "node dist/main.js"
```

### View logs:
```bash
tail -f logs/app.log  # if logging to file
```

### Test PostgreSQL:
```bash
pnpm prisma studio
```

### Test Redis:
```bash
# Test connection
redis-cli -u redis://default:PASSWORD@HOST:PORT ping
```

## 📊 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| TypeScript Build | ✅ | No errors |
| PostgreSQL | ✅ | Neon cloud connected |
| Redis | ⚠️ | May fail but app continues |
| Bull MQ | ⚠️ | Depends on Redis |
| Bot Service | ✅ | Code complete |
| Screenshot Service | ✅ | With fallback |
| Admin Panel | ⏳ | Not tested |
| Telegram Bot | ⏳ | Needs runtime test |

## 🔄 Alternative: Local Setup

Agar cloud services ishlamasa:

### 1. Local PostgreSQL
```bash
# Install PostgreSQL locally
# Create database
createdb timetable_bot

# Update .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/timetable_bot
```

### 2. Local Redis
```bash
# Install Redis
# Start Redis
redis-server

# Update .env
REDIS_URL=redis://localhost:6379
```

### 3. Run migrations
```bash
pnpm prisma migrate deploy
```

## 📝 Next Steps

1. **Test Bot Token**: Telegram bot token to'g'riligini tekshiring
2. **Test Admin ID**: Admin ID to'g'ri kiritilganini tekshiring
3. **Start Bot**: Botni ishga tushiring va `/start` command yuboring
4. **Monitor Logs**: Xatolarni kuzatib boring
5. **Test Functions**: Har bir funksiyani ketma-ket test qiling

## 💡 Tips

- Redis cloud ishlamasa, `REDIS_URL` ni localhost ga o'zgartiring yoki Redis'siz ishlating
- Puppeteer headless mode Windows'da muammo bersa, `headless: 'new'` qiling
- Screenshot'lar `screenshots/` papkasida saqlanadi
- Cache 8 soat (default) davom qiladi

## ⚡ Quick Test Commands

```bash
# 1. Build
pnpm build

# 2. Test DB
pnpm prisma studio

# 3. Start bot
node dist/main.js

# 4. In Telegram, send:
/start
/menu
/status
```

---

**Last Updated**: 2025-11-29
**Status**: Ready for runtime testing
