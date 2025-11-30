# TSUE Timetable Bot

Telegram bot for viewing TSUE university timetables with screenshot caching functionality.

## Features

- 📅 **Interactive Schedule Viewing**: Browse faculty, course, and group schedules via inline keyboards
- 📸 **Smart Screenshot Caching**: Screenshots cached for 8 hours using Redis + PostgreSQL
- 🔄 **Refresh Functionality**: Update screenshots on demand with a single button
- 📊 **Statistics Dashboard**: View total users and last update timestamps
- 🔐 **Admin Panel**: Web-based admin interface for managing users and cache
- 📨 **Broadcasting**: Admin can send messages to all users via `/send` command
- ⚡ **High Performance**: Uses BullMQ for queue management and Puppeteer for screenshots

## Tech Stack

- **NestJS** - TypeScript framework
- **grammY** - Telegram bot framework
- **Puppeteer** - Headless browser for screenshots
- **PostgreSQL** - Persistent data storage
- **Redis** - Fast in-memory caching
- **Prisma** - Database ORM
- **BullMQ** - Job queue for screenshot processing
- **React + Vite** - Admin panel frontend

## Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 14+
- Redis 6+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd sherali_tg_bot
```

### 2. Install dependencies

```bash
pnpm install
cd admin-panel && pnpm install && cd ..
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```env
# Telegram Bot Configuration
BOT_TOKEN=YOUR_BOT_TOKEN                # Get from @BotFather
ADMIN_ID=123456789                       # Your Telegram user ID

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Logging Configuration
LOG_LEVEL=debug

# Admin Panel Configuration
ADMIN_PASSWORD=your_secure_admin_password
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Screenshot Configuration (8 hours = 28800000ms)
SCREENSHOT_CACHE_DURATION=28800000
SCREENSHOT_QUALITY=85
PUPPETEER_CONCURRENCY=7

# Server Configuration
NODE_ENV=production
PORT=3000
```

### 4. Setup database

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate
```

### 5. Build the project

```bash
# Build backend
pnpm build

# Build admin panel
pnpm admin:build
```

## Running the Application

### Development Mode

```bash
# Start backend with hot reload
pnpm start:dev

# Start admin panel (separate terminal)
pnpm admin:dev
```

### Production Mode

```bash
pnpm start:prod
```

The bot will start automatically, and the admin panel will be available at `http://localhost:3000`.

## Bot Commands

### User Commands
- `/start` - Start the bot and show main menu
- `/menu` - Show main menu with schedule selection
- `/status` - Show bot statistics (total users, last update time)

### Admin Commands
- `/send [message]` - Broadcast message to all users (admin only)

## Project Structure

```
src/
├── app.module.ts           # Main application module
├── main.ts                 # Application entry point
├── bot/                    # Telegram bot logic
│   ├── bot.module.ts
│   ├── bot.service.ts      # Bot handlers and commands
│   └── services/
│       ├── keyboard.service.ts  # Inline keyboard builder
│       └── user.service.ts      # User management
├── screenshot/             # Screenshot processing
│   ├── screenshot.module.ts
│   ├── screenshot.service.ts    # Screenshot orchestration
│   ├── screenshot.processor.ts  # BullMQ worker
│   ├── browser.service.ts       # Puppeteer browser manager
│   └── cache.service.ts         # Redis + PostgreSQL caching
├── prisma/                 # Database ORM
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── redis/                  # Redis client
│   ├── redis.module.ts
│   └── redis.service.ts
├── admin/                  # Admin panel API
│   ├── admin.module.ts
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   └── auth.service.ts
└── common/                 # Shared utilities
    ├── filters/
    └── services/
```

## How It Works

### Screenshot Caching Flow

1. User selects faculty → course → group
2. Bot checks Redis cache for screenshot
3. If not in Redis, checks PostgreSQL database
4. If cache exists and is < 8 hours old, returns cached screenshot
5. If no valid cache, adds job to BullMQ queue
6. Puppeteer worker captures new screenshot
7. Screenshot saved to disk and metadata cached in Redis + PostgreSQL
8. User receives screenshot with refresh button

### Admin Panel

Access at `http://localhost:3000` with credentials:
- Username: `admin`
- Password: Set in `.env` as `ADMIN_PASSWORD`

Features:
- View all users and their selections
- View cached screenshots
- Clear cache entries
- View system logs
- Manage settings

## Docker Support

```bash
# Build and run with Docker Compose
docker-compose up -d
```

This will start:
- PostgreSQL database
- Redis cache
- NestJS application

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram bot token | `YOUR_BOT_TOKEN` |
| `ADMIN_ID` | Telegram admin user ID | `123456789` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/dbname` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `LOG_LEVEL` | Logging level | `debug` |
| `SCREENSHOT_CACHE_DURATION` | Cache duration in ms (8 hours) | `28800000` |
| `SCREENSHOT_QUALITY` | JPEG quality (0-100) | `85` |
| `PUPPETEER_CONCURRENCY` | Max concurrent screenshot jobs | `7` |
| `PORT` | Server port | `3000` |

## Troubleshooting

### Bot doesn't start
- Check `BOT_TOKEN` is correct
- Verify network connection to Telegram API

### Screenshots not generating
- Ensure Puppeteer dependencies are installed
- Check disk space in `/screenshots` folder
- Verify Redis and PostgreSQL connections

### Admin panel 404
- Run `pnpm admin:build` first
- Check `PORT` environment variable

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
