# 🚀 Digital Ocean Droplet - To'liq Deployment Qo'llanmasi

Bu qo'llanma Telegram botni Digital Ocean dropletga to'liq o'rnatish va ishga tushirish bo'yicha step-by-step ko'rsatma.

---

## 📋 Mundarija

1. [Digital Ocean Droplet Yaratish](#1-digital-ocean-droplet-yaratish)
2. [SSH Kalitlarni Sozlash](#2-ssh-kalitlarni-sozlash)
3. [Serverni Sozlash](#3-serverni-sozlash)
4. [Loyihani Deploy Qilish](#4-loyihani-deploy-qilish)
5. [.env Faylni Sozlash](#5-env-faylni-sozlash)
6. [Botni Ishga Tushirish](#6-botni-ishga-tushirish)
7. [Monitoring va Troubleshooting](#7-monitoring-va-troubleshooting)

---

## 1. 📱 Digital Ocean Droplet Yaratish

### 1.1. Digital Ocean'ga kirish
1. https://cloud.digitalocean.com ga kiring
2. **Create** → **Droplets** bosing

### 1.2. Droplet Sozlamalari

**Image:** Ubuntu 22.04 (LTS) x64

**Droplet Size (Tavsiya):**
- **Basic Plan:** $6/month (1 GB RAM, 1 vCPU, 25 GB SSD)
- **Better:** $12/month (2 GB RAM, 1 vCPU, 50 GB SSD) ✅ Tavsiya etiladi

**Datacenter Region:**
- Frankfurt (yaqinroq serverlar)
- Amsterdam
- Singapore (Osiyo uchun)

**Authentication:**
- ✅ **SSH Key** (xavfsizroq, tavsiya etiladi)
- Password (kamroq xavfsiz)

**Hostname:** `sherali-telegram-bot`

**Tags:** `telegram-bot`, `production`

### 1.3. Droplet Yaratish
1. **Create Droplet** tugmasini bosing
2. 1-2 daqiqa kutib, droplet tayyor bo'lguncha kuting
3. IP addressni ko'chirib oling (masalan: `142.93.22.81`)

---

## 2. 🔑 SSH Kalitlarni Sozlash

### 2.1. SSH Kalitini Yaratish (Windows)

```bash
# Git Bash yoki PowerShell'da
ssh-keygen -t rsa -b 4096 -f ~/.ssh/droplet_2

# Parol so'rasa, Enter bosing (yoki parol kiriting)
```

### 2.2. SSH Kalitini Digital Ocean'ga Qo'shish

**Usul 1: Web orqali**
1. Digital Ocean → Settings → Security → SSH Keys
2. **Add SSH Key** bosing
3. Public key'ni ko'chirib qo'ying:
```bash
cat ~/.ssh/droplet_2.pub
```
4. Name: `My_Laptop_Key`
5. **Add SSH Key** bosing

**Usul 2: Droplet yaratishda**
- Droplet yaratayotganda **SSH Key** section'da **Add New SSH Key**

### 2.3. SSH Ulanishni Test Qilish

```bash
ssh -i ~/.ssh/droplet_2 root@142.93.22.81
```

Agar ulanish bo'lsa:
```
Welcome to Ubuntu 22.04.3 LTS...
root@sherali-telegram-bot:~#
```

✅ **Muvaffaqiyatli!** Endi serverdasiz.

---

## 3. 🔧 Serverni Sozlash

### 3.1. Birinchi Ulanish

```bash
# Local mashinangizdan
ssh -i ~/.ssh/droplet_2 root@142.93.22.81
```

### 3.2. Setup Script'ni Yuklash va Ishga Tushirish

**Usul 1: Setup script bilan (Tavsiya etiladi)**

```bash
# Serverda
cd /root

# Setup script'ni yuklab olish
curl -o setup-droplet.sh https://raw.githubusercontent.com/XushvaqtovSardor/sherali_bot2/main/setup-droplet.sh

# Executable qilish
chmod +x setup-droplet.sh

# Ishga tushirish
bash setup-droplet.sh
```

Bu script quyidagilarni o'rnatadi:
- ✅ Docker va Docker Compose
- ✅ Node.js va pnpm
- ✅ Git
- ✅ Firewall (UFW)
- ✅ Project directory
- ✅ Loyihani clone qilish
- ✅ .env template yaratish

**⏱️ Taxminan 5-10 daqiqa davom etadi**

### 3.3. Manual Setup (Agar script ishlamasa)

<details>
<summary>Manual o'rnatish ko'rsatmalari</summary>

```bash
# System update
apt-get update && apt-get upgrade -y

# Basic tools
apt-get install -y curl wget git vim nano htop ca-certificates gnupg lsb-release jq unzip

# Docker installation
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose
apt-get install -y docker-compose-plugin

# Start Docker
systemctl start docker
systemctl enable docker

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# pnpm
npm install -g pnpm

# Project directory
mkdir -p /var/www/sherali_bot
cd /var/www/sherali_bot

# Clone repository
git clone https://github.com/XushvaqtovSardor/sherali_bot2.git .

# Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw enable
```

</details>

---

## 4. 🚀 Loyihani Deploy Qilish

### 4.1. Deploy Script bilan (Eng Oson Usul)

**Local mashinangizda:**

```bash
cd /d/c_p/sherali_tg_bot

# Script'ni executable qilish
chmod +x deploy-to-droplet.sh

# Deploy qilish
./deploy-to-droplet.sh
```

Bu script avtomatik ravishda:
1. ✅ Git'ga push qiladi
2. ✅ Serverga ulanadi
3. ✅ Yangi kodni tortadi
4. ✅ Docker build qiladi
5. ✅ Containerni ishga tushiradi

### 4.2. Manual Deploy

**Serverda:**

```bash
cd /var/www/sherali_bot

# Yangi kodni tortish
git pull origin main

# Containerlarni to'xtatish
docker-compose down

# Rebuild
docker-compose build --no-cache

# Ishga tushirish
docker-compose up -d
```

---

## 5. 📝 .env Faylni Sozlash

### 5.1. .env Faylni Yaratish

**Serverda:**

```bash
cd /var/www/sherali_bot

# .env template'dan nusxa olish
cp .env.production .env

# Tahrirlash
nano .env
```

### 5.2. Majburiy O'zgaruvchilar

**.env faylida quyidagilarni to'ldiring:**

```env
# ============== MAJBURIY ==============

# Bot token - @BotFather dan oling
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Sizning Telegram User ID - @userinfobot dan oling
ADMIN_ID=123456789

# Admin panel paroli (o'zingizniki kiriting)
ADMIN_PASSWORD=MySecurePassword123!

# JWT secret (random string, min 32 belgili)
# Generate: openssl rand -base64 32
JWT_SECRET=xK8nP2mQ5vR9wT3yH7jL6fN4gS1dA0zX

# Server IP yoki domain
DOMAIN=http://142.93.22.81
```

### 5.3. Bot Token Olish

1. Telegram'da **@BotFather** ga yozing
2. `/newbot` yuboring
3. Bot nomi kiriting: `TSUE Timetable Bot`
4. Bot username kiriting: `tsue_timetable_bot` (unikal bo'lishi kerak)
5. Token olasiz: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### 5.4. Admin ID Olish

1. **@userinfobot** ga yozing
2. Sizning ID'ingizni olasiz: `123456789`

### 5.5. .env Saqlash

```bash
# Ctrl+O - saqlash
# Enter - tasdiqlash
# Ctrl+X - chiqish
```

### 5.6. Supabase (Optional)

Agar cloud storage kerak bo'lsa:

```env
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your-anon-key-here
```

Aks holda bo'sh qoldiring:
```env
SUPABASE_URL=
SUPABASE_KEY=
```

---

## 6. 🎯 Botni Ishga Tushirish

### 6.1. Containerlarni Ishga Tushirish

```bash
cd /var/www/sherali_bot

# Build va start
docker-compose up -d
```

### 6.2. Statusni Tekshirish

```bash
# Containerlarni ko'rish
docker ps -a

# Loglarni ko'rish
docker logs -f timetable_bot

# Health check
curl http://localhost:3000/api/health
```

### 6.3. Kutilayotgan Loglar

```
========================================
🚀 Starting application...
========================================
✓ NestJS application created
✓ CORS enabled
✓ Shutdown hooks enabled
========================================
✓ Application is running on: http://0.0.0.0:3000
========================================

========================================
☁️ Initializing Firebase/Supabase Service...
⚠️ SUPABASE_KEY not configured
⚠️ Cloud storage disabled - using local storage only
========================================

========================================
🔴 Initializing Redis connection...
✓ REDIS_URL loaded: redis://redis:6379
✅ Redis connected successfully
========================================

========================================
📦 Connecting to PostgreSQL database...
✅ PostgreSQL connected successfully
========================================

========================================
🤖 Bot service initialization started
========================================
✓ BOT_TOKEN loaded: 1234567890:...
✓ Webhook deleted successfully
✓ Bot authenticated as: @your_bot (ID: ...)
✅ BOT STARTED SUCCESSFULLY!
✅ Bot is now listening for messages...
========================================
```

✅ **Bot ishlayapti!**

---

## 7. 📊 Monitoring va Troubleshooting

### 7.1. Loglarni Ko'rish

```bash
# Jonli loglar
docker logs -f timetable_bot

# Oxirgi 100 qator
docker logs --tail 100 timetable_bot

# Xatolarni qidirish
docker logs timetable_bot 2>&1 | grep -i "error\|failed"
```

### 7.2. Health Check

```bash
# Oddiy health check
curl http://localhost:3000/api/health

# Batafsil status
curl http://localhost:3000/api/status | jq .
```

**Natija:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-10T...",
  "uptime": 3600,
  "services": {
    "database": {
      "status": "connected",
      "type": "PostgreSQL"
    },
    "redis": {
      "status": "connected",
      "type": "Redis"
    }
  }
}
```

### 7.3. Container Boshqaruvi

```bash
# Barcha containerlar
docker ps -a

# Bot container'ini restart
docker-compose restart app

# Barcha containerlarni restart
docker-compose restart

# To'xtatish
docker-compose down

# Qayta ishga tushirish
docker-compose up -d

# Rebuild
docker-compose up -d --build
```

### 7.4. Resource Monitoring

```bash
# CPU va RAM
docker stats

# Disk space
df -h

# System monitoring
htop
```

### 7.5. Keng Tarqalgan Muammolar

#### ❌ Bot javob bermayapti

**1. Container ishlamayapti:**
```bash
docker ps -a | grep timetable_bot
# Agar "Exited" ko'rinsa:
docker logs timetable_bot
docker-compose restart app
```

**2. 409 Error (Conflict):**
```bash
# Boshqa bot instance ishlab turibdi
docker-compose down
pkill -f node
docker-compose up -d
```

**3. Database ulanmayapti:**
```bash
# PostgreSQL statusini tekshirish
docker logs timetable_postgres

# Restart
docker-compose restart postgres
docker-compose restart app
```

**4. Redis xatoligi:**
```bash
docker logs timetable_redis
docker-compose restart redis
docker-compose restart app
```

#### 🔄 Yangilash (Update)

```bash
cd /var/www/sherali_bot

# Yangi kodni tortish
git pull origin main

# Rebuild va restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Yoki deploy script:
# Local mashinada: ./deploy-to-droplet.sh
```

### 7.6. Backup

```bash
# Database backup
docker exec timetable_postgres pg_dump -U postgres timetable_bot > backup.sql

# .env backup
cp .env .env.backup.$(date +%Y%m%d)

# Docker volumes backup
docker run --rm --volumes-from timetable_postgres -v $(pwd):/backup ubuntu tar cvf /backup/postgres_data.tar /var/lib/postgresql/data
```

### 7.7. Foydali Komandalar

```bash
# Telegram bot'ni test qilish
# @your_bot_username ga /start yuboring

# Logs bilan ishlash
docker logs -f timetable_bot --since 10m  # Oxirgi 10 daqiqa
docker logs timetable_bot > logs.txt      # File'ga saqlash

# Container ichiga kirish
docker exec -it timetable_bot sh

# Database'ga ulanish
docker exec -it timetable_postgres psql -U postgres -d timetable_bot

# Redis'ga ulanish
docker exec -it timetable_redis redis-cli
```

---

## 8. 🔐 Xavfsizlik

### 8.1. SSH Kalitlarni Xavfsiz Saqlash

- ✅ Private key (`droplet_2`) ni hech kimga bermang
- ✅ GitHub'ga commit qilmang
- ✅ Backup qilib saqlang

### 8.2. .env Xavfsizligi

- ✅ `.env` faylni GitHub'ga commit qilmang
- ✅ Tokenlar va parollarni xavfsiz saqlang
- ✅ `ADMIN_PASSWORD` va `JWT_SECRET` ni kuchli qiling

### 8.3. Firewall

```bash
# Firewall statusini tekshirish
ufw status

# Faqat kerakli portlar ochiq:
# 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (Bot)
```

### 8.4. SSL/HTTPS (Optional)

Agar domain bo'lsa, Let's Encrypt bilan SSL qo'shing:

```bash
apt-get install certbot
certbot certonly --standalone -d yourdomain.com
```

---

## 9. ✅ Tekshirish Checklist

Deploy qilgandan keyin:

- [ ] Bot container ishlayapti: `docker ps | grep timetable_bot`
- [ ] Logda xato yo'q: `docker logs timetable_bot | grep -i error`
- [ ] Health check ishlayapti: `curl http://localhost:3000/api/health`
- [ ] Database ulanishda: Status'da `"database": "connected"`
- [ ] Redis ulanishda: Status'da `"redis": "connected"`
- [ ] Bot Telegram'da javob beradi: @your_bot'ga `/start` yuboring
- [ ] Admin commands ishlaydi: `/admin` kommandasini sinab ko'ring

---

## 10. 📞 Yordam

### Dokumentatsiya
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Keng tarqalgan muammolar
- [SUPABASE_FIX.md](./SUPABASE_FIX.md) - Supabase xatoliklari

### Foydali Linklar
- Digital Ocean: https://www.digitalocean.com/docs/
- Docker: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/

### Log Fayllar
```bash
# Barcha loglarni saqlash
docker logs timetable_bot > bot_logs.txt 2>&1
docker logs timetable_postgres > db_logs.txt 2>&1
docker logs timetable_redis > redis_logs.txt 2>&1
```

---

## 11. 🎓 Xulosa

Ushbu qo'llanma bo'yicha:
1. ✅ Digital Ocean droplet yaratdingiz
2. ✅ Server o'rnatildi (Docker, Node.js, Git)
3. ✅ Loyiha deploy qilindi
4. ✅ .env sozlandi
5. ✅ Bot ishga tushdi
6. ✅ Monitoring sozlandi

**Bot muvaffaqiyatli ishlayapti!** 🎉

---

## 🚀 Quick Start Summary

Qisqa ko'rinishda:

```bash
# 1. Local mashinada
git add .
git commit -m "Ready for production"
git push

# 2. Serverga ulanish
ssh -i ~/.ssh/droplet_2 root@142.93.22.81

# 3. Setup
curl -o setup-droplet.sh https://raw.githubusercontent.com/XushvaqtovSardor/sherali_bot2/main/setup-droplet.sh
bash setup-droplet.sh

# 4. .env sozlash
cd /var/www/sherali_bot
cp .env.production .env
nano .env  # BOT_TOKEN, ADMIN_ID, passwords

# 5. Ishga tushirish
docker-compose up -d

# 6. Tekshirish
docker logs -f timetable_bot
curl http://localhost:3000/api/health
```

**Tayyor! ✅**
