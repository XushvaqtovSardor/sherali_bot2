# Network Troubleshooting Guide

## Server ichida network muammolarini tekshirish

### 1. Diagnostika scripti ishga tushiring:
```bash
docker exec sherali_bot sh /app/scripts/check-network.sh
```

### 2. Tezkor diagnostika:
```bash
# DNS va connectivity test
docker exec sherali_bot nslookup tsue.edupage.org
docker exec sherali_bot ping -c 3 8.8.8.8
docker exec sherali_bot curl -I https://tsue.edupage.org --max-time 10

# DNS resolverlarni tekshirish
docker exec sherali_bot cat /etc/resolv.conf
```

### 3. DNS muammosi bo'lsa:
```bash
# Docker containerlarni qayta ishga tushirish DNS sozlamalari bilan
docker-compose down
docker-compose up -d

# Yoki manual DNS to'g'rilash
docker exec -it sherali_bot sh
echo "nameserver 8.8.8.8" > /etc/resolv.conf
echo "nameserver 8.8.4.4" >> /etc/resolv.conf
echo "nameserver 1.1.1.1" >> /etc/resolv.conf
exit
```

### 4. Firewall muammosi bo'lsa:
Server provayderingiz (DigitalOcean) firewall sozlamalarini tekshiring:
- Port 443 (HTTPS) ochiq bo'lishi kerak
- Outbound traffic ruxsat etilgan bo'lishi kerak

### 4. Docker network muammosi bo'lsa:
```bash
# Docker network qayta yaratish
docker-compose down
docker network prune -f
docker-compose up -d
```

### 5. Manual test:
```bash
# Container ichida test
docker exec -it sherali_bot sh
curl -I https://tsue.edupage.org
wget https://tsue.edupage.org -O test.html
```

## Umumiy muammolar va yechimlar:

### ERR_CONNECTION_TIMED_OUT
**Sabab:** Server tashqi saytga ulanolmayapti
**Yechim:** 
- Firewall sozlamalarini tekshiring
- DNS sozlamalarini tekshiring  
- VPN yoki proxy kerak bo'lishi mumkin

### DNS resolution failed
**Sabab:** DNS server ishlamayapti
**Yechim:**
```bash
# docker-compose.yml ga qo'shing:
services:
  app:
    dns:
      - 8.8.8.8
      - 1.1.1.1
```

### Chrome not found
**Sabab:** Chromium o'rnatilmagan
**Yechim:**
```dockerfile
# Dockerfile da mavjud:
RUN apk add --no-cache chromium
```

## Yangi xususiyatlar:

1. **Multi-strategy navigation** - 3 xil usul bilan sahifaga ulanish
2. **Better error messages** - aniqroq xatolik xabarlari
3. **Network optimization** - Chrome uchun maxsus network parametrlari
4. **Progressive retry** - har bir retry da ko'proq kutish (10s, 20s, 30s)
5. **DNS prefetch disable** - sekinroq lekin ishonchliroq

## Qo'shimcha:

Agar barcha yechimlar ishlamasa, VPN yoki proxy server orqali ulanish kerak bo'lishi mumkin.
