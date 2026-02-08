# Deployment Fixes - Connection Timeout Issues

## Muammo
Digital Ocean serverda `ERR_CONNECTION_TIMED_OUT` xatosi - tsue.edupage.org saytiga ulanolmayapti.

## O'zgartirilgan fayllar

### 1. docker-compose.yml
DNS resolverlar va network optimizatsiyalari qo'shildi:
```yaml
dns:
  - 8.8.8.8
  - 8.8.4.4
  - 1.1.1.1
extra_hosts:
  - "tsue.edupage.org:185.158.175.49"
sysctls:
  - net.ipv4.tcp_keepalive_time=600
  - net.ipv4.tcp_keepalive_intvl=60
  - net.ipv4.tcp_keepalive_probes=3
```

### 2. Dockerfile
- DNS resolverlar configured
- Network diagnostics tools qo'shildi (bind-tools, iputils, net-tools)

### 3. Browser Service (browser.service.ts)
- User-Agent qo'shildi bot detectionni oldini olish uchun
- Extra HTTP headers (Accept-Language, Accept, Connection, etc.)
- `--disable-blink-features=AutomationControlled` flag

### 4. Screenshot Service (screenshot.service.ts)
- 3 marta retry logikasi (exponential backoff)
- Fallback navigation strategy (networkidle2 → domcontentloaded)
- Detalliroq logging

## Deploy qilish

1. **Serverda Docker containerlarni to'xtatish:**
```bash
cd /root/sherali_tg_bot
docker-compose down
```

2. **Yangi kodlarni pull qilish:**
```bash
git pull origin main
```

3. **Docker cache'ni tozalash va rebuild:**
```bash
docker system prune -a -f
docker-compose build --no-cache
```

4. **Ishga tushirish:**
```bash
docker-compose up -d
```

5. **Loglarni kuzatish:**
```bash
docker logs -f sherali_bot
```

## Diagnostika

Network muammolarini tekshirish:
```bash
# Container ichida diagnostika
docker exec sherali_bot sh /app/scripts/check-network.sh

# DNS test
docker exec sherali_bot nslookup tsue.edupage.org 8.8.8.8

# Connection test
docker exec sherali_bot curl -I https://tsue.edupage.org --max-time 30

# Container ichiga kirish
docker exec -it sherali_bot sh
```

## Agar hali ham ishlamasa

### Variant 1: Manual DNS IP qo'shish
Digital Ocean firewall orqali tsue.edupage.org blocklanishi mumkin. Agar shunday bo'lsa:

```bash
# Host serverda test qiling
curl -I https://tsue.edupage.org

# Agar host serverda ishlayotgan bo'lsa, Docker network muammosi
# Container network modeni o'zgartiring
```

docker-compose.yml ga qo'shing:
```yaml
app:
  network_mode: "host"
```

### Variant 2: Proxy server ishlatish
Agar geo-blocking bo'lsa, proxy server orqali ulanish kerak.

### Variant 3: VPN
Server butunlay VPN orqali internet olishi kerak bo'lishi mumkin.

## Tekshirish kerak bo'lgan narsalar

1. **DigitalOcean Firewall Settings:**
   - Outbound HTTPS (port 443) allowed
   - No geo-restrictions

2. **Server DNS:**
```bash
cat /etc/resolv.conf
ping 8.8.8.8
```

3. **Docker Network:**
```bash
docker network ls
docker network inspect sherali_tg_bot_default
```

## Expected Results

Agar hammasi to'g'ri bo'lsa, logda shunday ko'rinishi kerak:
```
[ScreenshotService] Screenshot attempt 1/3 for https://tsue.edupage.org/...
[ScreenshotService] Navigating to: https://tsue.edupage.org/...
[ScreenshotService] Page loaded, waiting for content...
[ScreenshotService] ✅ Screenshot succeeded
```

Agar xatolik bo'lsa, retry ishga tushadi va 3 marta urinadi.
