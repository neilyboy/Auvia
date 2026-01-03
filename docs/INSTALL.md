# 📘 Installation Guide

Complete setup instructions for deploying Auvia on your server.

---

## Table of Contents

- [Requirements](#requirements)
- [Quick Install](#quick-install)
- [Detailed Installation](#detailed-installation)
  - [Ubuntu/Debian](#ubuntudebian)
  - [CentOS/RHEL](#centosrhel)
  - [Unraid](#unraid)
  - [Synology NAS](#synology-nas)
- [Post-Installation Setup](#post-installation-setup)
- [Updating Auvia](#updating-auvia)
- [Uninstalling](#uninstalling)

---

## Requirements

### Minimum Hardware
- **CPU**: 2 cores
- **RAM**: 2GB
- **Storage**: 10GB for application + space for music library

### Recommended Hardware
- **CPU**: 4+ cores
- **RAM**: 4GB+
- **Storage**: SSD for database, HDD for music storage

### Software Requirements
- **Docker**: 20.10 or newer
- **Docker Compose**: v2.0 or newer
- **Git**: For cloning the repository

### Network Requirements
- Port **3000** (Frontend)
- Port **8001** (Backend API)
- Outbound HTTPS access to Qobuz API

### Account Requirements
- **Qobuz Subscription**: Studio Premier or higher recommended for Hi-Res audio

---

## Quick Install

For experienced users, here's the quick version:

```bash
# Clone and enter directory
git clone https://github.com/neilyboy/Auvia.git && cd Auvia

# Configure environment
cp .env.example .env
nano .env  # Edit MUSIC_PATH_1 to your music storage location

# Start services
docker compose up -d

# Access at http://your-ip:3000
```

---

## Detailed Installation

### Ubuntu/Debian

#### Step 1: Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to docker group (log out and back in after)
sudo usermod -aG docker $USER
```

#### Step 2: Clone Auvia

```bash
# Clone the repository
git clone https://github.com/neilyboy/Auvia.git
cd Auvia
```

#### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Important settings to change:**

```env
# Change the database password
POSTGRES_PASSWORD=your-secure-password-here

# Set your music storage path (must exist and be writable)
MUSIC_PATH_1=/path/to/your/music/storage

# Generate a secure secret key
SECRET_KEY=$(openssl rand -hex 32)
```

#### Step 4: Create Music Directory

```bash
# Create music storage directory
sudo mkdir -p /path/to/your/music/storage
sudo chown -R $USER:$USER /path/to/your/music/storage
```

#### Step 5: Start Auvia

```bash
# Build and start all services
docker compose up -d

# Check if services are running
docker compose ps

# View logs
docker compose logs -f
```

#### Step 6: Verify Installation

```bash
# Check backend health
curl http://localhost:8001/api/health

# Should return: {"status":"healthy"}
```

---

### CentOS/RHEL

#### Step 1: Install Docker

```bash
# Remove old versions
sudo yum remove docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine

# Install required packages
sudo yum install -y yum-utils

# Add Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
```

Then follow Steps 2-6 from the Ubuntu/Debian section.

---

### Unraid

#### Step 1: Install via Community Applications

1. Open **Apps** tab in Unraid
2. Search for "Docker Compose Manager" and install it
3. Open a terminal and clone Auvia:

```bash
cd /mnt/user/appdata
git clone https://github.com/neilyboy/Auvia.git
cd Auvia
```

#### Step 2: Configure

```bash
cp .env.example .env
nano .env
```

Set your paths to Unraid shares:

```env
MUSIC_PATH_1=/mnt/user/Music
MUSIC_PATH_2=/mnt/user/Music2
```

#### Step 3: Start

```bash
docker compose up -d
```

#### Step 4: Add to Unraid Dashboard (Optional)

Add port mappings to your Docker settings for visibility in the Unraid dashboard.

---

### Synology NAS

#### Step 1: Enable Docker

1. Open **Package Center**
2. Search for and install **Container Manager** (or Docker on older DSM)

#### Step 2: SSH into NAS

```bash
ssh admin@your-synology-ip
sudo -i
```

#### Step 3: Clone and Configure

```bash
cd /volume1/docker
git clone https://github.com/neilyboy/Auvia.git
cd Auvia
cp .env.example .env
vi .env
```

Configure paths:

```env
MUSIC_PATH_1=/volume1/music
```

#### Step 4: Start

```bash
docker compose up -d
```

#### Step 5: Configure Firewall

In DSM, go to **Control Panel** → **Security** → **Firewall** and allow ports 3000 and 8001.

---

## Post-Installation Setup

### 1. Access the Web Interface

Open your browser and navigate to:

```
http://your-server-ip:3000
```

### 2. Configure Qobuz Credentials

1. Click the **Settings** icon (⚙️) in the bottom navigation
2. Enter your Qobuz **email** and **password**
3. Click **Save**

### 3. Test the Setup

1. Go to **Search** and search for an artist or album
2. Click **Play** on any result
3. The music will download and start playing

### 4. Access from Mobile Devices

On any device connected to your network:

1. Open a browser
2. Navigate to `http://your-server-ip:3000`
3. Add to home screen for app-like experience

---

## Updating Auvia

### Standard Update

```bash
cd /path/to/Auvia

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

### Update with Data Preservation

```bash
cd /path/to/Auvia

# Pull latest changes
git pull origin main

# Rebuild only (preserves database)
docker compose build --no-cache
docker compose up -d
```

---

## Uninstalling

### Remove Containers Only (Preserve Data)

```bash
cd /path/to/Auvia
docker compose down
```

### Complete Removal (Including Data)

```bash
cd /path/to/Auvia

# Stop and remove containers, volumes, and images
docker compose down -v --rmi all

# Remove the directory
cd ..
rm -rf Auvia
```

> ⚠️ **Warning**: This will delete your database and all settings. Your downloaded music files will remain in your music storage directory.

---

## Troubleshooting Installation

### Docker Permission Denied

```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### Port Already in Use

Edit `.env` and change the ports:

```env
FRONTEND_PORT=3001  # Change from 3000
BACKEND_PORT=8002   # Change from 8001
```

### Database Connection Failed

Check PostgreSQL is running:

```bash
docker compose logs db
```

### Frontend Can't Connect to Backend

Ensure both containers are on the same network:

```bash
docker network ls
docker compose down && docker compose up -d
```

---

## Next Steps

- 📖 Read the [Configuration Guide](CONFIGURATION.md) for advanced settings
- 🔧 Check [Troubleshooting](TROUBLESHOOTING.md) if you encounter issues
- 🎵 Start enjoying your music!

---

[← Back to README](../README.md)
