# ⚙️ Configuration Guide

Complete reference for all Auvia configuration options.

---

## Table of Contents

- [Environment Variables](#environment-variables)
- [Docker Compose Settings](#docker-compose-settings)
- [Storage Configuration](#storage-configuration)
- [Qobuz Settings](#qobuz-settings)
- [Audio Quality Settings](#audio-quality-settings)
- [Network Configuration](#network-configuration)
- [Security Settings](#security-settings)
- [Advanced Configuration](#advanced-configuration)

---

## Environment Variables

All configuration is done through the `.env` file in the project root.

### Database Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_USER` | PostgreSQL username | `auvia` | No |
| `POSTGRES_PASSWORD` | PostgreSQL password | `auvia_secret` | **Yes** (change in production) |
| `POSTGRES_DB` | Database name | `auvia` | No |
| `DATABASE_URL` | Full database connection string | Auto-generated | No |

**Example:**
```env
POSTGRES_USER=auvia
POSTGRES_PASSWORD=MySecurePassword123!
POSTGRES_DB=auvia
```

### Application Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SECRET_KEY` | JWT signing key for authentication | `change-me-in-production` | **Yes** |
| `APP_NAME` | Application display name | `Auvia` | No |
| `APP_TAGLINE` | Application tagline | `Set the Atmosphere` | No |
| `DEBUG` | Enable debug mode | `false` | No |

**Generate a secure secret key:**
```bash
openssl rand -hex 32
```

### Port Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_PORT` | Port for web interface | `3000` |
| `BACKEND_PORT` | Port for API server | `8001` |

**Example for non-standard ports:**
```env
FRONTEND_PORT=8080
BACKEND_PORT=8081
```

### Storage Paths

| Variable | Description | Default |
|----------|-------------|---------|
| `MUSIC_PATH_1` | Primary music storage | `./music` |
| `MUSIC_PATH_2` | Secondary storage (optional) | `./music2` |
| `MUSIC_PATH_3` | Tertiary storage (optional) | `./music3` |

**Example with absolute paths:**
```env
MUSIC_PATH_1=/mnt/storage/music
MUSIC_PATH_2=/mnt/backup/music
MUSIC_PATH_3=/mnt/external/music
```

---

## Docker Compose Settings

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Custom Network

```yaml
networks:
  auvia-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Persistent Data Volumes

Data is automatically persisted in Docker volumes:

- `postgres_data` - Database files
- `redis_data` - Cache data

To use bind mounts instead:

```yaml
volumes:
  - ./data/postgres:/var/lib/postgresql/data
  - ./data/redis:/data
```

---

## Storage Configuration

### Single Drive Setup

For a simple single-drive setup:

```env
MUSIC_PATH_1=/home/user/Music
```

### Multi-Drive Setup

For larger libraries across multiple drives:

```env
MUSIC_PATH_1=/mnt/ssd/music          # Fast SSD for frequently played
MUSIC_PATH_2=/mnt/hdd1/music         # Large HDD for main library
MUSIC_PATH_3=/mnt/hdd2/music         # Backup/overflow storage
```

### Network Storage (NFS/SMB)

Mount network shares before starting Auvia:

```bash
# NFS mount
sudo mount -t nfs server:/share/music /mnt/music

# Add to /etc/fstab for persistence
server:/share/music /mnt/music nfs defaults 0 0
```

Then configure:
```env
MUSIC_PATH_1=/mnt/music
```

### Storage Permissions

Ensure the Docker container can read/write:

```bash
# Set ownership
sudo chown -R 1000:1000 /path/to/music

# Or set permissions
sudo chmod -R 755 /path/to/music
```

---

## Qobuz Settings

### In-App Configuration

1. Open Auvia at `http://your-server:3000`
2. Click **Settings** (⚙️) in the bottom navigation
3. Enter your Qobuz credentials:
   - **Email**: Your Qobuz account email
   - **Password**: Your Qobuz account password
4. Click **Save**

### Quality Settings

Qobuz offers multiple quality levels:

| Quality | Format | Bitrate | File Size (per album) |
|---------|--------|---------|----------------------|
| MP3 320 | MP3 | 320 kbps | ~100 MB |
| CD Quality | FLAC | 16-bit/44.1kHz | ~300 MB |
| Hi-Res | FLAC | 24-bit/96kHz | ~800 MB |
| Hi-Res+ | FLAC | 24-bit/192kHz | ~1.5 GB |

> **Note**: Hi-Res quality requires Qobuz Studio Premier subscription.

### Streamrip Configuration

Advanced streamrip settings can be configured in:
`/root/.config/streamrip/config.toml` (inside the backend container)

```bash
# Access container
docker compose exec backend bash

# Edit config
nano /root/.config/streamrip/config.toml
```

Key settings:
```toml
[qobuz]
quality = 3  # 0=MP3, 1=CD, 2=Hi-Res, 3=Hi-Res+

[downloads]
folder = "/music"
```

---

## Audio Quality Settings

### Recommended Quality by Use Case

| Use Case | Recommended Quality | Reason |
|----------|---------------------|--------|
| Background music | CD Quality | Good balance of quality and storage |
| Audiophile listening | Hi-Res+ | Maximum quality |
| Limited storage | MP3 320 | Smallest file size |
| Mixed use | Hi-Res | Great quality, reasonable size |

### Changing Default Quality

Edit the streamrip config:

```bash
docker compose exec backend bash
nano /root/.config/streamrip/config.toml
```

Set quality level:
```toml
[qobuz]
quality = 2  # Hi-Res (24-bit/96kHz)
```

Restart the backend:
```bash
docker compose restart backend
```

---

## Network Configuration

### Accessing from Other Devices

Auvia automatically detects the server's IP address for external access.

To find your server's IP:
```bash
ip addr show | grep inet
# or
hostname -I
```

Access from other devices:
```
http://SERVER_IP:3000
```

### Reverse Proxy Setup

#### Nginx

```nginx
server {
    listen 80;
    server_name auvia.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Traefik

```yaml
# docker-compose.override.yml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.auvia.rule=Host(`auvia.example.com`)"
      - "traefik.http.services.auvia.loadbalancer.server.port=3000"
```

#### Caddy

```
auvia.example.com {
    reverse_proxy localhost:3000
    
    handle_path /api/* {
        reverse_proxy localhost:8001
    }
}
```

### SSL/HTTPS

For production, use a reverse proxy with SSL. Example with Certbot:

```bash
sudo certbot --nginx -d auvia.example.com
```

---

## Security Settings

### Change Default Passwords

**Always change these in production:**

```env
POSTGRES_PASSWORD=your-secure-database-password
SECRET_KEY=your-64-character-random-string
```

### Firewall Configuration

Only expose necessary ports:

```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 8001/tcp  # Backend API

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --reload
```

### Container Security

Run containers as non-root (production):

```yaml
services:
  backend:
    user: "1000:1000"
```

---

## Advanced Configuration

### Custom Docker Network

```yaml
networks:
  auvia:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: auvia0
```

### Health Checks

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Logging Configuration

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Environment-Specific Configs

Create separate compose files:

```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

---

## Configuration Checklist

Before going to production, ensure you've:

- [ ] Changed `POSTGRES_PASSWORD` from default
- [ ] Generated a unique `SECRET_KEY`
- [ ] Configured correct `MUSIC_PATH_*` locations
- [ ] Set up firewall rules
- [ ] Configured backup strategy for database
- [ ] Set up reverse proxy with SSL (if exposing to internet)
- [ ] Tested access from mobile devices

---

[← Back to README](../README.md) | [Installation Guide](INSTALL.md) | [Troubleshooting →](TROUBLESHOOTING.md)
