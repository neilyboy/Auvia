# 🔌 API Reference

Complete reference for the Auvia REST API.

---

## Base URL

```
http://your-server:8001/api
```

## Authentication

Currently, the API does not require authentication for most endpoints. Admin endpoints may require authentication in future versions.

---

## Endpoints

### Health Check

#### GET /health

Check if the API server is running.

**Response:**
```json
{
  "status": "healthy"
}
```

---

### Search

#### GET /search

Search across albums, tracks, and artists.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `include_remote` | boolean | No | Include Qobuz results (default: true) |

**Response:**
```json
{
  "query": "pink floyd",
  "albums": [...],
  "tracks": [...],
  "artists": [...]
}
```

#### GET /search/albums

Search for albums only.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Results per page (default: 20) |

#### GET /search/tracks

Search for tracks only.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Results per page (default: 20) |

#### GET /search/artists

Search for artists only.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Results per page (default: 20) |

---

### Music Library

#### GET /music/albums

Get all downloaded albums.

**Response:**
```json
[
  {
    "id": 1,
    "title": "The Dark Side of the Moon",
    "artist_name": "Pink Floyd",
    "artist_id": 1,
    "qobuz_id": "abc123",
    "cover_art_url": "https://...",
    "release_date": "1973-03-01",
    "total_tracks": 10,
    "is_downloaded": true
  }
]
```

#### GET /music/albums/{album_id}

Get album details with tracks.

**Response:**
```json
{
  "id": 1,
  "title": "The Dark Side of the Moon",
  "artist_name": "Pink Floyd",
  "tracks": [
    {
      "id": 1,
      "title": "Speak to Me",
      "track_number": 1,
      "duration": 90,
      "is_downloaded": true
    }
  ]
}
```

#### GET /music/albums/by-qobuz/{qobuz_id}

Find a local album by its Qobuz ID.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | No | Album title for fallback matching |
| `artist` | string | No | Artist name for fallback matching |

**Response:**
```json
{
  "found": true,
  "album": { ... }
}
```

#### GET /music/artists

Get all artists in library.

#### GET /music/artists/{artist_id}

Get artist details with albums.

#### POST /music/scan

Trigger a library scan to detect new files.

**Response:**
```json
{
  "message": "Scan complete",
  "stats": {
    "albums": 5,
    "tracks": 47,
    "errors": 0
  }
}
```

#### POST /music/verify

Verify all downloaded files exist on disk.

**Response:**
```json
{
  "message": "Verification complete",
  "stats": {
    "verified": 100,
    "missing_tracks": 0,
    "missing_albums": 0
  }
}
```

---

### Streaming

#### GET /music/stream/{track_id}

Stream an audio file.

**Headers:**
- Supports `Range` header for seeking

**Response:**
- Audio file stream (FLAC, MP3, etc.)
- Status 200 for full file
- Status 206 for partial content (range request)

#### GET /music/cover/{album_id}

Get album cover art.

**Response:**
- JPEG/PNG image
- Cached for 24 hours

---

### Queue Management

#### POST /queue/add

Add a track to the playback queue.

**Body:**
```json
{
  "track_id": 1,
  "qobuz_track_id": "abc123",
  "qobuz_album_url": "https://...",
  "play_now": false
}
```

#### POST /queue/play-album

Download and play an entire album.

**Body:**
```json
{
  "qobuz_album_url": "https://www.qobuz.com/album/..."
}
```

---

### Trending

#### GET /trending/albums

Get trending albums from Qobuz.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | integer | No | Number of results (default: 20) |

**Response:**
```json
[
  {
    "title": "Album Title",
    "artist_name": "Artist",
    "qobuz_id": "abc123",
    "qobuz_url": "https://...",
    "cover_art_url": "https://..."
  }
]
```

---

### Settings

#### GET /settings

Get current application settings.

#### PUT /settings

Update application settings.

**Body:**
```json
{
  "qobuz_email": "user@example.com",
  "qobuz_password": "password",
  "download_quality": 3
}
```

#### GET /settings/storage

Get storage location configuration.

#### PUT /settings/storage

Update storage locations.

---

## Data Models

### Album

```json
{
  "id": 1,
  "title": "string",
  "artist_name": "string",
  "artist_id": 1,
  "qobuz_id": "string",
  "qobuz_url": "string",
  "cover_art_url": "string",
  "cover_art_local": "string",
  "release_date": "2024-01-01",
  "genre": "string",
  "total_tracks": 10,
  "duration": 3600,
  "is_downloaded": true,
  "tracks": [...]
}
```

### Track

```json
{
  "id": 1,
  "title": "string",
  "artist_name": "string",
  "album_title": "string",
  "album_id": 1,
  "qobuz_id": "string",
  "track_number": 1,
  "disc_number": 1,
  "duration": 240,
  "duration_formatted": "4:00",
  "file_path": "/music/...",
  "is_downloaded": true,
  "play_count": 0,
  "cover_art_url": "string"
}
```

### Artist

```json
{
  "id": 1,
  "name": "string",
  "qobuz_id": "string",
  "image_url": "string",
  "albums": [...]
}
```

### SearchResult

```json
{
  "query": "string",
  "albums": [...],
  "tracks": [...],
  "artists": [...]
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "detail": "Invalid request parameters"
}
```

### 404 Not Found

```json
{
  "detail": "Resource not found"
}
```

### 422 Unprocessable Entity

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 500 Internal Server Error

```json
{
  "detail": "Internal server error"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. This may change in future versions.

---

## WebSocket (Future)

WebSocket support for real-time updates is planned for future versions.

---

[← Back to README](../README.md)
