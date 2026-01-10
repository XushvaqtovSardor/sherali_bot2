# 🚀 Tezkor Qo'llanma - Deployment Cheat Sheet

## 1️⃣ Birinchi Deploy (Yangi Server)

```bash
# === LOCAL MASHINADA ===

# 1. Git'ga push qiling
git add .
git commit -m "Production ready"
git push origin main

# === SERVERDA (SSH orqali) ===

# 2. Serverga ulanish
ssh -i ~/.ssh/droplet_2 root@142.93.22.81

# 3. Setup script
curl -o setup-droplet.sh https://raw.githubusercontent.com/XushvaqtovSardor/sherali_bot2/main/setup-droplet.sh
bash setup-droplet.sh

# 4. .env sozlash
cd /var/www/sherali_bot
cp .env.production .env
nano .env
# BOT_TOKEN, ADMIN_ID, ADMIN_PASSWORD, JWT_SECRET, DOMAIN

# 5. Ishga tushirish
docker-compose up -d

# 6. Tekshirish
docker logs -f timetable_bot
```

---

## 2️⃣ Keyingi Deploy (Yangilash)

```bash
# === USUL 1: Deploy Script (LOCAL) ===
cd /d/c_p/sherali_tg_bot
./deploy-to-droplet.sh

# === USUL 2: Manual (SERVER) ===
ssh -i ~/.ssh/droplet_2 root@142.93.22.81
cd /var/www/sherali_bot
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 3️⃣ Bot Token Olish

```bash
# Telegram'da:
# 1. @BotFather ga /newbot
# 2. Bot nomi: TSUE Timetable Bot
# 3. Username: tsue_timetable_bot
# 4. Token oling: 1234567890:ABCdef...

# Admin ID:
# @userinfobot ga ID so'rang
```

---

## 4️⃣ Tezkor Komandalar

```bash
# === Loglar ===
docker logs -f timetable_bot              # Jonli loglar
docker logs --tail 100 timetable_bot      # Oxirgi 100 qator
docker logs timetable_bot | grep ERROR    # Xatolarni qidirish

# === Health Check ===
curl http://localhost:3000/api/health     # Oddiy
curl http://localhost:3000/api/status     # Batafsil

# === Restart ===
docker-compose restart app                # Bot
docker-compose restart                    # Barchasi
docker-compose down && docker-compose up -d  # To'liq

# === Rebuild ===
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# === Status ===
docker ps -a                              # Containerlar
docker stats                              # Resources
df -h                                     # Disk
```

---

## 5️⃣ .env Majburiy O'zgaruvchilar

```env
BOT_TOKEN=1234567890:ABCdefGHI...         # @BotFather
ADMIN_ID=123456789                        # @userinfobot
ADMIN_PASSWORD=SecurePass123!             # O'zingizniki
JWT_SECRET=random32charsminimum...        # Random
DOMAIN=http://142.93.22.81                # Server IP
```

---

## 6️⃣ Xatoliklarni Tuzatish

```bash
# Bot javob bermayapti?
docker ps -a | grep timetable_bot         # Ishlaydimi?
docker logs --tail 50 timetable_bot       # Xatolar?
docker-compose restart app                # Restart

# 409 Error (Conflict)?
docker-compose down
pkill -f node
docker-compose up -d

# Database xatoligi?
docker logs timetable_postgres
docker-compose restart postgres app

# Redis xatoligi?
docker logs timetable_redis
docker-compose restart redis app
```

---

## 7️⃣ Backup

```bash
# Database
docker exec timetable_postgres pg_dump -U postgres timetable_bot > backup_$(date +%Y%m%d).sql

# .env
cp .env .env.backup.$(date +%Y%m%d)

# Restore
docker exec -i timetable_postgres psql -U postgres -d timetable_bot < backup_20260110.sql
```

---

## 8️⃣ Monitoring

```bash
# Real-time logs
docker logs -f timetable_bot

# System resources
htop
docker stats

# Disk space
df -h
du -sh /var/www/sherali_bot/*

# Network
netstat -tulpn | grep 3000
```

---

## 9️⃣ Security

```bash
# Firewall
ufw status
ufw allow 22/tcp
ufw allow 3000/tcp
ufw enable

# Update system
apt-get update && apt-get upgrade -y

# Check for updates
docker pull node:20-alpine
```

---

## 🔟 Foydali Linklar

- **Health Check:** `http://YOUR_IP:3000/api/health`
- **Status:** `http://YOUR_IP:3000/api/status`
- **Bot:** `@your_bot_username` (Telegram'da)

---

## 📝 Tezkor Deploy Buyruqlari

```bash
# === Bir qatorda to'liq deploy ===
ssh -i ~/.ssh/droplet_2 root@142.93.22.81 'cd /var/www/sherali_bot && git pull && docker-compose down && docker-compose build --no-cache && docker-compose up -d && docker logs --tail 30 timetable_bot'
```

---

## ⚠️ Eslatmalar

1. `.env` faylni hech qachon Git'ga commit qilmang!
2. Har doim deployment oldidan Git'ga push qiling
3. .env backup qiling
4. Loglarni muntazam tekshiring
5. Health check ishlaganini tekshiring

---

## 🆘 Tezkor Yordam

```bash
# Hammasi buzilgan bo'lsa:
docker-compose down
docker system prune -af
git pull origin main
cp .env.backup .env
docker-compose build --no-cache
docker-compose up -d
docker logs -f timetable_bot
```

---

**To'liq qo'llanma:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
**Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
