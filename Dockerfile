FROM node:22-alpine AS base
WORKDIR /app

# Install system dependencies including Chromium and network tools
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    dumb-init \
    curl \
    wget \
    bind-tools \
    iputils \
    net-tools \
    bash \
    openssl \
    libc6-compat

# Update CA certificates
RUN update-ca-certificates

# Configure Puppeteer to use system Chromium
# Alpine Linux has chromium at /usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_BIN=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium \
    CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

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

# Copy network diagnostic script
COPY scripts/check-network.sh /app/scripts/check-network.sh
RUN chmod +x /app/scripts/check-network.sh

# Test Chromium installation
RUN chromium --version || echo "WARNING: Chromium test failed"

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]