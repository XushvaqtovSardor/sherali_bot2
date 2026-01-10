# 🔧 Docker Database Configuration

## ✅ O'zgarishlar

Loyiha endi to'liq Docker ichida ishlaydi - tashqi database'lar kerak emas!

### Oldingi (Tashqi Services)
```env
DATABASE_URL=postgresql://neondb_owner:npg_...@aws.neon.tech/neondb
REDIS_URL=redis://default:...@redislabs.com:16408
```

### Hozir (Docker Ichida)
```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/timetable_bot
REDIS_URL=redis://redis:6379
```

---

## 📦 Docker Services

### PostgreSQL
- **Container:** `timetable_postgres`
- **Image:** `postgres:16-alpine`
- **Port:** `5432:5432`
- **Database:** `timetable_bot`
- **User:** `postgres`
- **Password:** `postgres`
- **Volume:** `postgres_data` (ma'lumotlar saqlanadi)

### Redis
- **Container:** `timetable_redis`
- **Image:** `redis:7-alpine`
- **Port:** `6379:6379`
- **Volume:** `redis_data` (cache saqlanadi)

### Bot Application
- **Container:** `timetable_bot`
- **Port:** `3000:3000`
- **Depends on:** PostgreSQL va Redis

---

## 🚀 Ishga Tushirish

```bash
# 1. Docker containerlarni ishga tushirish
docker-compose up -d

# 2. Statusni tekshirish
docker-compose ps

# 3. Loglarni ko'rish
docker logs -f timetable_bot
docker logs -f timetable_postgres
docker logs -f timetable_redis

# 4. Database migration
docker exec timetable_bot npx prisma migrate deploy
```

---

## ✅ Kutilayotgan Loglar

```
========================================
📦 Connecting to PostgreSQL database...
✅ PostgreSQL connected successfully
========================================

========================================
🔴 Initializing Redis connection...
✅ Redis connected successfully
========================================

========================================
🤖 Bot service initialization started
✅ BOT STARTED SUCCESSFULLY!
========================================
```

---

## 🔍 Database'ga Ulanish

### PostgreSQL
```bash
# Container ichidan
docker exec -it timetable_postgres psql -U postgres -d timetable_bot

# Tashqaridan (localhost)
psql -h localhost -p 5432 -U postgres -d timetable_bot
# Password: postgres
```

**SQL Queries:**
```sql
-- Barcha userlarni ko'rish
SELECT * FROM "User";

-- User statistikasi
SELECT COUNT(*) FROM "User";

-- Oxirgi 10 log
SELECT * FROM "UserLog" ORDER BY "createdAt" DESC LIMIT 10;
```

### Redis
```bash
# Container ichidan
docker exec -it timetable_redis redis-cli

# Redis commands
> PING
> KEYS *
> GET screenshot:some_key
> INFO
```

---

## 🛠️ Xotira va Cleanup

### Database Backup
```bash
# Backup
docker exec timetable_postgres pg_dump -U postgres timetable_bot > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i timetable_postgres psql -U postgres -d timetable_bot < backup_20260110.sql
```

### Redis Cache Tozalash
```bash
# Barcha cache'ni tozalash
docker exec timetable_redis redis-cli FLUSHALL

# Faqat screenshot cache
docker exec timetable_redis redis-cli --scan --pattern "screenshot:*" | xargs docker exec timetable_redis redis-cli DEL
```

### Volumes Tozalash
```bash
# Containerlarni to'xtatish
docker-compose down

# Volume'larni tozalash (MA'LUMOTLAR O'CHADI!)
docker-compose down -v

# Qayta boshlash (bo'sh database)
docker-compose up -d
```

---

## 📊 Resource Monitoring

```bash
# Container resource usage
docker stats timetable_postgres timetable_redis timetable_bot

# Disk space
docker system df
docker volume ls

# PostgreSQL ma'lumot hajmi
docker exec timetable_postgres du -sh /var/lib/postgresql/data
```

---

## ⚠️ Troubleshooting

### PostgreSQL ulanmayapti
```bash
# Container statusini tekshirish
docker ps -a | grep postgres

# Loglar
docker logs timetable_postgres

# Health check
docker exec timetable_postgres pg_isready -U postgres

# Restart
docker-compose restart postgres
```

### Redis ulanmayapti
```bash
# Status
docker ps -a | grep redis

# Loglar
docker logs timetable_redis

# Test
docker exec timetable_redis redis-cli PING

# Restart
docker-compose restart redis
```

### Port band bo'lsa
```bash
# 5432 portni tekshirish
lsof -i :5432
netstat -tulpn | grep 5432

# 6379 portni tekshirish
lsof -i :6379
netstat -tulpn | grep 6379

# Band bo'lgan process'ni to'xtatish
kill -9 <PID>
```

---

## 🔐 Security

### Production uchun
```bash
# .env da parollarni o'zgartiring
POSTGRES_PASSWORD=kuchli_parol_123
ADMIN_PASSWORD=yangi_admin_parol

# docker-compose.yml'da ham
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
```

### Port yopish (Production)
```bash
# docker-compose.yml'da portlarni comment qiling
services:
  postgres:
    # ports:
    #   - "5432:5432"  # Tashqaridan yopiq
  
  redis:
    # ports:
    #   - "6379:6379"  # Tashqaridan yopiq
```

Container'lar bir-biri bilan Docker network orqali bog'lanadi, tashqi kirish kerak emas.

---

## 💡 Afzalliklar

### Tashqi Database vs Docker Database

| Feature | Tashqi | Docker |
|---------|--------|--------|
| Setup | Murakkab | Oson |
| Cost | Pullik | Bepul |
| Speed | Sekinroq (network) | Tezroq (local) |
| Backup | Avtomatik | Manual |
| Scalability | Yuqori | O'rtacha |
| Portability | Kam | Yuqori |
| Development | Qiyin | Oson |

**Docker database tavsiya etiladi:**
- ✅ Development va testing uchun
- ✅ Kichik va o'rta loyihalar
- ✅ Bir serverdagi deployment
- ✅ Tez prototype

**Tashqi database kerak:**
- 📈 Juda katta loyihalar
- 📈 Ko'p serverli deployment
- 📈 Professional backup kerak
- 📈 High availability kerak

---

## 🎯 Quick Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Database shell
docker exec -it timetable_postgres psql -U postgres -d timetable_bot

# Redis shell
docker exec -it timetable_redis redis-cli

# Backup database
docker exec timetable_postgres pg_dump -U postgres timetable_bot > backup.sql

# Health check
curl http://localhost:3000/api/health
```

---

✅ **Hammasi tayyor! Endi loyiha to'liq Docker'da ishlaydi.**
