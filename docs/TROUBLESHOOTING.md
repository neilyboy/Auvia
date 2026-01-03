# 🔧 Troubleshooting Guide

Solutions to common issues with Auvia.

---

## Table of Contents

- [Installation Issues](#installation-issues)
- [Startup Problems](#startup-problems)
- [Playback Issues](#playback-issues)
- [Download Problems](#download-problems)
- [Network/Access Issues](#networkaccess-issues)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)
- [Getting Help](#getting-help)

---

## Installation Issues

### Docker Not Found

**Symptom:** `docker: command not found`

**Solution:**
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in
```

### Docker Compose Not Found

**Symptom:** `docker compose: command not found`

**Solution:**
```bash
# Install Docker Compose plugin
sudo apt install docker-compose-plugin

# Or use standalone version
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Permission Denied

**Symptom:** `Got permission denied while trying to connect to the Docker daemon`

**Solution:**
```bash
sudo usermod -aG docker $USER
newgrp docker  # Or log out and back in
```

### Port Already in Use

**Symptom:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :3000

# Change port in .env
FRONTEND_PORT=3001
BACKEND_PORT=8002

# Restart
docker compose down && docker compose up -d
```

---

## Startup Problems

### Containers Won't Start

**Check container status:**
```bash
docker compose ps
docker compose logs
```

### Database Connection Failed

**Symptom:** `could not connect to server: Connection refused`

**Solution:**
```bash
# Wait for database to be ready
docker compose logs db

# If stuck, restart
docker compose down
docker compose up -d

# Check database health
docker compose exec db pg_isready
```

### Backend Crashes on Startup

**Check logs:**
```bash
docker compose logs backend
```

**Common causes:**
1. Invalid environment variables
2. Database not ready
3. Missing dependencies

**Solution:**
```bash
# Rebuild backend
docker compose build --no-cache backend
docker compose up -d
```

### Frontend Shows Blank Page

**Check browser console** (F12) for errors.

**Common causes:**
1. Backend not running
2. CORS issues
3. JavaScript errors

**Solution:**
```bash
# Rebuild frontend
docker compose build --no-cache frontend
docker compose up -d
```

---

## Playback Issues

### Music Won't Play

**Symptom:** Click play, nothing happens

**Checklist:**
1. Check browser console for errors
2. Verify track is downloaded
3. Check backend logs

**Solution:**
```bash
# Check if track file exists
docker compose exec backend ls -la /music/

# Check backend logs
docker compose logs backend | grep -i error
```

### Crackling/Stuttering Audio

**Symptom:** Audio plays but sounds distorted

**Solutions:**
1. **Check network:** Ensure stable connection
2. **Browser issue:** Try different browser
3. **File corruption:** Re-download the album

```bash
# Force re-scan of library
curl -X POST http://localhost:8001/api/music/scan
```

### Pause Button Not Working

**Symptom:** Clicking pause doesn't stop music

**Solution:** Hard refresh the page (Ctrl+Shift+R)

If persists:
```bash
docker compose restart frontend
```

### Audio Plays on Wrong Device

**Solution:** Check browser audio output settings. On mobile, ensure no Bluetooth devices are connected unintentionally.

---

## Download Problems

### Downloads Not Starting

**Symptom:** Click download, nothing happens

**Check Qobuz credentials:**
```bash
# Check backend logs
docker compose logs backend | grep -i qobuz
```

**Solution:**
1. Go to Settings
2. Re-enter Qobuz credentials
3. Try downloading again

### Download Fails Immediately

**Symptom:** "Download failed" error

**Common causes:**
1. Invalid Qobuz credentials
2. Subscription doesn't support quality level
3. Album not available in your region

**Check streamrip logs:**
```bash
docker compose logs backend | grep -i streamrip
```

### Downloaded Music Not Appearing

**Symptom:** Download completes but not in library

**Solution:**
```bash
# Trigger library scan
curl -X POST http://localhost:8001/api/music/scan

# Check scan results
docker compose logs backend | grep -i scan
```

### Storage Full

**Symptom:** Downloads fail, disk space error

**Solution:**
```bash
# Check disk space
df -h

# Check music folder size
du -sh /path/to/music

# Add additional storage path in .env
MUSIC_PATH_2=/mnt/additional/storage
```

---

## Network/Access Issues

### Can't Access from Other Devices

**Symptom:** Works on server, not on phone/other computers

**Checklist:**
1. **Same network?** Ensure devices are on same WiFi/LAN
2. **Firewall?** Check server firewall
3. **Correct IP?** Use server's LAN IP, not localhost

**Find server IP:**
```bash
hostname -I
# or
ip addr show | grep inet
```

**Open firewall:**
```bash
# UFW
sudo ufw allow 3000
sudo ufw allow 8001

# firewalld
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --add-port=8001/tcp --permanent
sudo firewall-cmd --reload
```

### API Connection Refused

**Symptom:** Frontend loads but shows connection errors

**Solution:**
The frontend automatically detects the API URL. If issues persist:

```bash
# Check backend is running
curl http://localhost:8001/api/health

# Check from another device
curl http://SERVER_IP:8001/api/health
```

### CORS Errors

**Symptom:** Console shows "CORS policy" errors

**Solution:** Backend should allow all origins by default. If customized:

```bash
# Check backend CORS settings
docker compose logs backend | grep -i cors
```

---

## Database Issues

### Database Corrupted

**Symptom:** Random errors, missing data

**Solution - Reset database:**
```bash
# WARNING: This deletes all data
docker compose down
docker volume rm auvia_postgres_data
docker compose up -d
```

### Duplicate Albums/Tracks

**Symptom:** Same album appears multiple times

**Solution:**
```bash
# Connect to database
docker compose exec db psql -U auvia -d auvia

# Find duplicates
SELECT title, artist_id, COUNT(*) FROM albums GROUP BY title, artist_id HAVING COUNT(*) > 1;

# Exit
\q
```

For automatic cleanup, trigger a library scan which deduplicates:
```bash
curl -X POST http://localhost:8001/api/music/scan
```

### Missing Cover Art

**Symptom:** Albums show without artwork

**Common causes:**
1. Cover file not in album folder
2. Multi-disc album (cover in parent folder)
3. Scan didn't find it

**Solution:**
```bash
# Trigger rescan
curl -X POST http://localhost:8001/api/music/scan

# Check logs for cover detection
docker compose logs backend | grep -i cover
```

---

## Performance Issues

### Slow Search

**Symptom:** Search takes long time to return results

**Solutions:**
1. Check network connection to Qobuz
2. Reduce search result limit
3. Check database performance

```bash
# Check database connections
docker compose exec db psql -U auvia -c "SELECT count(*) FROM pg_stat_activity;"
```

### High Memory Usage

**Symptom:** Server running out of RAM

**Solutions:**
1. Add resource limits to docker-compose.yml
2. Reduce concurrent downloads
3. Restart containers periodically

```yaml
# Add to docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
```

### Slow Page Load

**Solutions:**
1. Enable browser caching
2. Use reverse proxy with caching
3. Check network speed

---

## Log Analysis

### Viewing Logs

```bash
# All services
docker compose logs

# Specific service
docker compose logs backend
docker compose logs frontend
docker compose logs db

# Follow logs in real-time
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100
```

### Common Log Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `Connection refused` | Service not ready | Wait or restart |
| `Authentication failed` | Wrong Qobuz credentials | Update in Settings |
| `File not found` | Missing audio file | Re-download or scan |
| `Permission denied` | File permission issue | Check ownership |

---

## Reset and Recovery

### Soft Reset (Keep Data)

```bash
docker compose restart
```

### Full Restart (Keep Data)

```bash
docker compose down
docker compose up -d
```

### Factory Reset (Delete Everything)

```bash
# Stop all containers
docker compose down

# Remove all data
docker volume rm auvia_postgres_data auvia_redis_data

# Remove images
docker compose down --rmi all

# Start fresh
docker compose up -d
```

> ⚠️ **Warning:** Factory reset deletes your database, settings, and download history. Music files in your storage paths are NOT deleted.

---

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Collect relevant logs

### Collecting Debug Information

```bash
# Save logs to file
docker compose logs > auvia-logs.txt

# System info
uname -a >> auvia-logs.txt
docker --version >> auvia-logs.txt
docker compose version >> auvia-logs.txt

# Container status
docker compose ps >> auvia-logs.txt
```

### Creating an Issue

When creating a GitHub issue, include:

1. **Description** of the problem
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Logs** (sanitize credentials!)
6. **Environment** (OS, Docker version, etc.)

---

[← Back to README](../README.md) | [Configuration](CONFIGURATION.md) | [Installation Guide](INSTALL.md)
