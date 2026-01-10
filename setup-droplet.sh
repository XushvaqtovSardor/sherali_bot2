#!/bin/bash

echo "=========================================="
echo "🔧 Digital Ocean Droplet Setup Script"
echo "=========================================="
echo "This script will install all required dependencies"
echo "for running the Telegram Bot on Ubuntu/Debian"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use: sudo bash setup-droplet.sh)"
    exit 1
fi

print_info "Starting system setup..."
echo ""

# Update system
echo "=========================================="
echo "📦 Step 1: Updating system packages..."
echo "=========================================="
apt-get update
apt-get upgrade -y
print_success "System updated"
echo ""

# Install basic tools
echo "=========================================="
echo "🛠️  Step 2: Installing basic tools..."
echo "=========================================="
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    nano \
    htop \
    ca-certificates \
    gnupg \
    lsb-release \
    jq \
    unzip
print_success "Basic tools installed"
echo ""

# Install Docker
echo "=========================================="
echo "🐳 Step 3: Installing Docker..."
echo "=========================================="

if command -v docker &> /dev/null; then
    print_warning "Docker already installed"
    docker --version
else
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start Docker
    systemctl start docker
    systemctl enable docker

    print_success "Docker installed successfully"
    docker --version
fi
echo ""

# Install Docker Compose
echo "=========================================="
echo "🐙 Step 4: Installing Docker Compose..."
echo "=========================================="

if command -v docker-compose &> /dev/null; then
    print_warning "Docker Compose already installed"
    docker-compose --version
else
    # Docker Compose v2 is included with docker-compose-plugin
    # But we'll also install standalone version for compatibility
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    print_success "Docker Compose installed successfully"
    docker-compose --version
fi
echo ""

# Install Node.js and npm (for local development if needed)
echo "=========================================="
echo "📗 Step 5: Installing Node.js..."
echo "=========================================="

if command -v node &> /dev/null; then
    print_warning "Node.js already installed"
    node --version
    npm --version
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    # Install pnpm
    npm install -g pnpm
    
    print_success "Node.js and pnpm installed successfully"
    node --version
    npm --version
    pnpm --version
fi
echo ""

# Configure firewall
echo "=========================================="
echo "🔥 Step 6: Configuring firewall..."
echo "=========================================="

if command -v ufw &> /dev/null; then
    # Allow SSH
    ufw allow 22/tcp
    # Allow HTTP
    ufw allow 80/tcp
    # Allow HTTPS
    ufw allow 443/tcp
    # Allow bot port
    ufw allow 3000/tcp
    
    # Enable firewall (only if not already enabled)
    ufw --force enable || print_warning "UFW already enabled"
    
    print_success "Firewall configured"
    ufw status
else
    print_warning "UFW not available, skipping firewall configuration"
fi
echo ""

# Create project directory
echo "=========================================="
echo "📁 Step 7: Creating project directory..."
echo "=========================================="
mkdir -p /var/www/sherali_bot
cd /var/www/sherali_bot
print_success "Project directory created: /var/www/sherali_bot"
echo ""

# Clone repository
echo "=========================================="
echo "📥 Step 8: Cloning repository..."
echo "=========================================="

if [ -d ".git" ]; then
    print_warning "Repository already cloned, pulling latest changes..."
    git pull origin main
else
    print_info "Cloning repository..."
    git clone https://github.com/XushvaqtovSardor/sherali_bot2.git .
    print_success "Repository cloned successfully"
fi
echo ""

# Create .env file
echo "=========================================="
echo "📝 Step 9: Creating .env file..."
echo "=========================================="

if [ -f ".env" ]; then
    print_warning ".env file already exists"
else
    print_info "Creating .env from template..."
    cat > .env << 'EOF'
# Telegram Bot Configuration
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
ADMIN_ID=YOUR_TELEGRAM_USER_ID

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/timetable_bot?schema=public

# Redis Configuration
REDIS_URL=redis://redis:6379

# Admin Panel Configuration
ADMIN_PASSWORD=change_this_secure_password
JWT_SECRET=change_this_to_random_string_minimum_32_characters
JWT_EXPIRES_IN=7d

# Screenshot Configuration
SCREENSHOT_CACHE_DURATION=28800000
SCREENSHOT_QUALITY=85
PUPPETEER_CONCURRENCY=7

# Supabase (Optional - leave empty if not using)
SUPABASE_URL=
SUPABASE_KEY=

# Server Configuration
NODE_ENV=production
PORT=3000
DOMAIN=http://YOUR_SERVER_IP
EOF

    print_success ".env file created"
    print_warning "IMPORTANT: Edit .env file with your actual values!"
    echo ""
    print_info "Run: nano /var/www/sherali_bot/.env"
    echo ""
    print_info "Required values to update:"
    echo "  - BOT_TOKEN (get from @BotFather)"
    echo "  - ADMIN_ID (your Telegram user ID)"
    echo "  - ADMIN_PASSWORD (for admin panel)"
    echo "  - JWT_SECRET (random string)"
    echo "  - DOMAIN (your server IP or domain)"
fi
echo ""

# Configure system limits
echo "=========================================="
echo "⚙️  Step 10: Configuring system limits..."
echo "=========================================="

# Increase file descriptors limit
if ! grep -q "fs.file-max" /etc/sysctl.conf; then
    echo "fs.file-max = 65536" >> /etc/sysctl.conf
    sysctl -p
fi

# Configure Docker logging
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

systemctl restart docker
print_success "System limits configured"
echo ""

# Install PM2 (optional, for non-Docker deployments)
echo "=========================================="
echo "🔄 Step 11: Installing PM2 (optional)..."
echo "=========================================="
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    print_success "PM2 installed"
else
    print_warning "PM2 already installed"
fi
echo ""

echo "=========================================="
echo "✅ SETUP COMPLETED SUCCESSFULLY!"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1️⃣  Edit .env file:"
echo "    nano /var/www/sherali_bot/.env"
echo ""
echo "2️⃣  Build and start containers:"
echo "    cd /var/www/sherali_bot"
echo "    docker-compose build"
echo "    docker-compose up -d"
echo ""
echo "3️⃣  Check logs:"
echo "    docker logs -f timetable_bot"
echo ""
echo "4️⃣  Check health:"
echo "    curl http://localhost:3000/api/health"
echo ""
echo "=========================================="
echo "📚 Useful Commands:"
echo "=========================================="
echo "  View containers:  docker ps -a"
echo "  View logs:        docker logs -f timetable_bot"
echo "  Restart bot:      docker-compose restart app"
echo "  Stop all:         docker-compose down"
echo "  Rebuild:          docker-compose up -d --build"
echo "  System status:    htop"
echo "  Disk usage:       df -h"
echo ""
echo "🔗 Access Points:"
echo "  Bot API:         http://YOUR_SERVER_IP:3000"
echo "  Health Check:    http://YOUR_SERVER_IP:3000/api/health"
echo "  Status:          http://YOUR_SERVER_IP:3000/api/status"
echo ""
echo "=========================================="
echo "✅ Setup script completed!"
echo "=========================================="
