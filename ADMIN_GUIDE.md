# Telegram Bot - Admin Panel

## O'zgarishlar

### Screenshot Cache olib tashlandi
- Har safar user so'rov yuborganida saytdan yangi screenshot olinadi
- Cache endi ishlatilmaydi, rasm yuborilgandan keyin o'chiriladi

### Admin Tizimi
- Admin tizimi database orqali boshqariladi
- Telegram ID orqali adminlar tanib olinadi
- Bir admin boshqa adminlarni qo'shishi va o'chirishi mumkin

### Environment Variables (Yangilangan)
```.env
# Telegram Bot Configuration
BOT_TOKEN=your_bot_token

# Database Configuration
DATABASE_URL=postgres://postgres:sheralibot@db:5432/sherali_datadb

# Server Configuration
PORT=3000
NODE_ENV=production

# Screenshot Settings
SCREENSHOT_CACHE_DURATION=28800000
SCREENSHOT_QUALITY=95
PUPPETEER_CONCURRENCY=3

# Logging
LOG_LEVEL=log
```

## Birinchi Adminni Qo'shish

1. Telegram ID ni olish: @userinfobot dan foydalaning
2. Migration faylini yangilash:
   ```bash
   # prisma/migrations/20260208_add_first_admin/migration.sql
   # O'z Telegram ID va username ni kiriting
   ```

3. Migrationni ishga tushirish:
   ```bash
   pnpm prisma migrate deploy
   ```

## Admin Commandlar

- `/admin` - Admin panelni ochish
- `/addadmin` - Admin qo'shish (foydalanuvchi xabariga reply qiling)
- `/addadmin <telegram_id> <username>` - ID bo'yicha admin qo'shish
- `/removeadmin <telegram_id>` - Adminni o'chirish
- `/listadmins` - Adminlar ro'yxati
- `/broadcast <xabar>` - Barcha foydalanuvchilarga xabar yuborish

## Admin Panel Funksiyalari

1. **📊 Statistika** - Foydalanuvchilar statistikasi
2. **👥 Foydalanuvchilar** - Ro'yxat (birinchi 50 ta)
3. **📝 Loglar** - Oxirgi 20 ta log
4. **👨‍💼 Adminlar** - Admin ro'yxati
5. **📢 Xabar yuborish** - Broadcast qilish yo'riqnomasi

## Serverga Deploy Qilish

1. `.env` faylini to'ldiring
2. Build qiling:
   ```bash
   pnpm run build
   ```

3. Docker Compose bilan ishga tushiring:
   ```bash
   docker-compose up -d
   ```

4. Migrationlarni ishga tushiring:
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

5. Birinchi adminni qo'shing:
   ```bash
   docker-compose exec db psql -U postgres -d sherali_datadb -c "INSERT INTO admins (id, telegram_id, username, created_at) VALUES (gen_random_uuid(), 'YOUR_TELEGRAM_ID', 'your_username', NOW()) ON CONFLICT DO NOTHING;"
   ```

## Kontakt va Saytdan Screenshot Olish

Screenshot olishda sahifaning pastki qismidagi "Kontakt" bo'limi avtomatik yashirinadi va qirqib olinadi. Bu yaxshiroq ko'rinish beradi.

## Texnik Ma'lumotlar

- **Node.js**: 22+
- **PostgreSQL**: 16
- **NestJS**: Framework
- **Puppeteer**: Screenshot uchun
- **Grammy**: Telegram Bot framework
- **Prisma**: ORM
