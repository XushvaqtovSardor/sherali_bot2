FROM node:22-alpine AS base
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    dumb-init \
    curl \
    wget

# Configure Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Copy source code and prisma files
COPY prisma ./prisma
COPY tsconfig.json nest-cli.json prisma.config.ts ./
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN pnpm run build

# Verify migrations are present
RUN ls -la /app/prisma/migrations/ || echo "WARNING: No migrations found"

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]