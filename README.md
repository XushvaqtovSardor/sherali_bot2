# 🤖 TSUE Telegram Timetable Bot

Telegram bot for TSUE (Tashkent State University of Economics) timetable management.

## 📋 Features

- ✅ Multi-language support (UZ, RU, EN)
- ✅ Interactive timetable viewing
- ✅ Screenshot generation with caching
- ✅ Redis-based caching system
- ✅ Admin panel for management
- ✅ User analytics and logging
- ✅ Docker-based deployment
- ✅ PostgreSQL database
- ✅ Health monitoring endpoints

## 🚀 Quick Start (Production)

### Prerequisites
- Digital Ocean Droplet (Ubuntu 22.04)
- Domain or IP address
- Telegram Bot Token (from @BotFather)

### Deployment

**Step 1: Setup Server**
```bash
ssh root@your-server-ip

# Download and run setup script
curl -o setup-droplet.sh https://raw.githubusercontent.com/XushvaqtovSardor/sherali_bot2/main/setup-droplet.sh
bash setup-droplet.sh
```

**Step 2: Configure Environment**
```bash
cd /var/www/sherali_bot
nano .env

# Update these values:
# BOT_TOKEN=your_bot_token
# ADMIN_ID=your_telegram_id
# ADMIN_PASSWORD=secure_password
# JWT_SECRET=random_32_char_string
# DOMAIN=http://your-server-ip
```

**Step 3: Start Bot**
```bash
docker-compose up -d
docker logs -f timetable_bot
```

**Step 4: Verify**
```bash
curl http://localhost:3000/api/health
```

📚 **Full Documentation:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🛠️ Development

### Local Setup

```bash
# Clone repository
git clone https://github.com/XushvaqtovSardor/sherali_bot2.git
cd sherali_bot2

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Generate Prisma client
pnpm prisma:generate

# Start development server
pnpm start:dev
```

### Environment Variables

See [.env.example](./.env.example) for all available options.

Required variables:
- `BOT_TOKEN` - Telegram bot token
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ADMIN_ID` - Telegram admin user ID
- `JWT_SECRET` - Secret for JWT tokens

## 📦 Tech Stack

- **Framework:** NestJS
- **Bot Library:** Grammy
- **Database:** PostgreSQL + Prisma
- **Cache:** Redis + BullMQ
- **Screenshots:** Puppeteer
- **Storage:** Supabase (optional)
- **Deployment:** Docker + Docker Compose

## 🏗️ Project Structure

```
sherali_tg_bot/
├── src/
│   ├── bot/              # Bot logic and handlers
│   ├── admin/            # Admin panel API
│   ├── screenshot/       # Screenshot generation
│   ├── prisma/           # Database service
│   ├── redis/            # Cache service
│   ├── firebase/         # Cloud storage (optional)
│   └── health/           # Health check endpoints
├── prisma/               # Database schema
├── admin-panel/          # Admin web interface
├── docker-compose.yml    # Docker configuration
├── Dockerfile            # Docker image
└── deploy-to-droplet.sh  # Deployment script
```

## 📊 API Endpoints

- `GET /api/health` - Health check
- `GET /api/status` - Detailed system status
- `POST /api/admin/login` - Admin login
- `GET /api/admin/users` - User statistics

## 🔍 Monitoring

### Check Logs
```bash
docker logs -f timetable_bot
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Container Status
```bash
docker-compose ps
docker stats
```

## 🐛 Troubleshooting

Common issues and solutions: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

Supabase issues: [SUPABASE_FIX.md](./SUPABASE_FIX.md)

## 📝 Scripts

```bash
# Development
pnpm start:dev          # Start in watch mode
pnpm build              # Build project
pnpm start:prod         # Start production build

# Database
pnpm prisma:generate    # Generate Prisma client
pnpm prisma:migrate     # Run migrations

# Deployment
./deploy-to-droplet.sh  # Deploy to server
./setup-droplet.sh      # Setup new server
```

## 🔐 Security

- Never commit `.env` files
- Keep SSH keys secure
- Use strong passwords
- Enable firewall (UFW)
- Regular backups

## 📈 Performance

- Redis caching for fast responses
- Screenshot caching (8 hours)
- BullMQ for background jobs
- Docker resource limits
- Automatic cleanup tasks

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

**Xushvaqtov Sardor**
- GitHub: [@XushvaqtovSardor](https://github.com/XushvaqtovSardor)
- Repository: [sherali_bot2](https://github.com/XushvaqtovSardor/sherali_bot2)

## 🙏 Acknowledgments

- NestJS team for amazing framework
- Grammy bot library
- Digital Ocean for hosting
- TSUE for timetable data

## 📞 Support

- Issues: [GitHub Issues](https://github.com/XushvaqtovSardor/sherali_bot2/issues)
- Documentation: [Wiki](./DEPLOYMENT_GUIDE.md)

---

**Status:** 🟢 Production Ready

**Version:** 1.0.0

**Last Updated:** January 2026
