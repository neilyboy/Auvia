import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Shuffle, Download, Check, Clock } from 'lucide-react'
import TrackItem from '../components/TrackItem'
import api, { API_URL } from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import toast from 'react-hot-toast'

export default function Album() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [playAfterDownload, setPlayAfterDownload] = useState(false)
  const { setQueue, addToQueue } = usePlayerStore()

  useEffect(() => {
    fetchAlbum()
  }, [id])
  
  // Poll for download completion
  useEffect(() => {
    let pollInterval
    if (downloading && album?.qobuz_id) {
      pollInterval = setInterval(async () => {
        try {
          // Use the by-qobuz endpoint which triggers a scan and finds by qobuz_id
          const response = await api.get(`/music/albums/by-qobuz/${album.qobuz_id}`)
          if (response.data?.found && response.data?.album?.is_downloaded && response.data?.album?.tracks?.length > 0) {
            setAlbum(response.data.album)
            setDownloading(false)
            toast.success('Download complete!', { id: 'download' })
            
            // If play was requested, start playing
            if (playAfterDownload && response.data.album.tracks?.length > 0) {
              setQueue(response.data.album.tracks)
              setPlayAfterDownload(false)
              navigate('/queue')
            }
          }
        } catch (error) {
          console.log('Polling for download completion...')
        }
      }, 5000) // Check every 5 seconds (scan takes time)
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [downloading, album?.qobuz_id, playAfterDownload, navigate, setQueue])

  const fetchAlbum = async () => {
    setLoading(true)
    try {
      // Check if it's a Qobuz ID or local ID
      if (id.startsWith('qobuz-')) {
        const qobuzId = id.replace('qobuz-', '')
        
        // First fetch album info from Qobuz to get title/artist
        let qobuzAlbum = null
        try {
          const qobuzResponse = await api.get('/search/albums', {
            params: { q: qobuzId, limit: 1 }
          })
          if (qobuzResponse.data?.length > 0) {
            qobuzAlbum = qobuzResponse.data[0]
          }
        } catch (e) {
          console.log('Could not fetch Qobuz album info')
        }
        
        // Now check if we have a local copy by qobuz_id OR title+artist
        try {
          const params = {}
          if (qobuzAlbum) {
            params.title = qobuzAlbum.title
            params.artist = qobuzAlbum.artist_name
          }
          const localResponse = await api.get(`/music/albums/by-qobuz/${qobuzId}`, { params })
          if (localResponse.data?.found && localResponse.data?.album?.is_downloaded) {
            // Use local version - it has tracks
            setAlbum(localResponse.data.album)
            setLoading(false)
            return
          }
        } catch (e) {
          // No local copy, continue to use Qobuz data
        }
        
        // Use Qobuz album data
        if (qobuzAlbum) {
          setAlbum(qobuzAlbum)
        }
      } else {
        const response = await api.get(`/music/albums/${id}`)
        setAlbum(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch album:', error)
      toast.error('Failed to load album')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAll = async () => {
    if (album?.tracks?.length > 0) {
      setQueue(album.tracks)
      toast.success(`Playing ${album.title}`)
      navigate('/queue')
    } else if (album?.qobuz_url) {
      // Download and play when ready
      setPlayAfterDownload(true)
      await handleDownload()
    }
  }

  const handleShuffle = () => {
    if (album?.tracks?.length > 0) {
      const shuffled = [...album.tracks].sort(() => Math.random() - 0.5)
      setQueue(shuffled)
      toast.success(`Shuffling ${album.title}`)
    }
  }

  const handleDownload = async () => {
    if (!album?.qobuz_url || downloading) return
    
    setDownloading(true)
    toast.loading('Downloading album...', { id: 'download' })
    try {
      await api.post('/queue/play-album', { qobuz_album_url: album.qobuz_url })
      // Don't dismiss toast - polling will update it when complete
    } catch (error) {
      toast.error('Failed to download album', { id: 'download' })
      setDownloading(false)
      setPlayAfterDownload(false)
    }
  }

  const handlePlayTrack = (track, index) => {
    if (album?.tracks?.length > 0) {
      setQueue(album.tracks, index)
    } else {
      // Single track play with download
      toast.loading('Downloading...', { id: 'download' })
      api.post('/queue/add', {
        qobuz_track_id: track.qobuz_id,
        qobuz_album_url: album?.qobuz_url,
        play_now: true
      }).then(() => {
        toast.success('Track queued', { id: 'download' })
      }).catch(() => {
        toast.error('Failed to queue track', { id: 'download' })
      })
    }
  }

  const totalDuration = album?.tracks?.reduce((acc, t) => acc + (t.duration || 0), 0) || album?.duration || 0

  if (loading) {
    return (
      <div className="p-4 pt-8 animate-pulse">
        <div className="h-8 w-8 bg-auvia-card rounded mb-6" />
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-64 aspect-square bg-auvia-card rounded-2xl" />
          <div className="flex-1">
            <div className="h-8 bg-auvia-card rounded w-3/4 mb-2" />
            <div className="h-5 bg-auvia-card rounded w-1/2 mb-4" />
            <div className="flex gap-2">
              <div className="h-10 w-24 bg-auvia-card rounded-full" />
              <div className="h-10 w-24 bg-auvia-card rounded-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!album) {
    return (
      <div className="p-4 pt-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-auvia-muted touch-feedback">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center py-20">
          <p className="text-auvia-muted text-lg">Album not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pt-8">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        className="p-2 -ml-2 mb-4 text-auvia-muted hover:text-white touch-feedback"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Album Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Cover Art */}
        <div className="w-full md:w-64 aspect-square rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
          {(album.is_downloaded && album.id) || album.cover_art_url ? (
            <img 
              src={album.is_downloaded && album.id ? `${API_URL}/api/music/cover/${album.id}` : album.cover_art_url} 
              alt={album.title}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div className={`w-full h-full bg-auvia-card items-center justify-center ${(album.is_downloaded && album.id) || album.cover_art_url ? 'hidden' : 'flex'}`}>
            <span className="text-8xl">💿</span>
          </div>
        </div>

        {/* Album Info */}
        <div className="flex flex-col justify-end">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            {album.title}
          </h1>
          <p className="text-auvia-muted text-lg mb-2">
            {album.artist_name}
          </p>
          <div className="flex items-center gap-3 text-auvia-muted text-sm mb-4">
            {album.release_date && (
              <span>{album.release_date.slice(0, 4)}</span>
            )}
            {album.total_tracks && (
              <span>{album.total_tracks} tracks</span>
            )}
            {totalDuration > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatTotalDuration(totalDuration)}
              </span>
            )}
            {album.is_downloaded && (
              <span className="flex items-center gap-1 text-green-500">
                <Check size={14} />
                Downloaded
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-6 py-3 bg-auvia-accent rounded-full text-white font-medium touch-feedback"
            >
              <Play size={18} className="ml-0.5" />
              Play
            </button>
            {album.tracks?.length > 1 && (
              <button
                onClick={handleShuffle}
                className="flex items-center gap-2 px-6 py-3 bg-auvia-card rounded-full text-white font-medium touch-feedback"
              >
                <Shuffle size={18} />
                Shuffle
              </button>
            )}
            {!album.is_downloaded && album.qobuz_url && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-white font-medium touch-feedback ${
                  downloading ? 'bg-auvia-accent/50 cursor-wait' : 'bg-auvia-card'
                }`}
              >
                <Download size={18} className={downloading ? 'animate-pulse' : ''} />
                {downloading ? 'Downloading...' : 'Download'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Track List */}
      {album.tracks?.length > 0 ? (
        <div className="space-y-1">
          {album.tracks.map((track, index) => (
            <TrackItem 
              key={track.id || track.qobuz_id || index}
              track={track}
              index={index}
              onPlay={() => handlePlayTrack(track, index)}
              onAddToQueue={() => addToQueue(track)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          {downloading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-auvia-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-auvia-muted">Downloading tracks...</p>
            </div>
          ) : (
            <p className="text-auvia-muted">
              {album.is_downloaded ? 'No tracks found' : 'Download album to see tracks'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function formatTotalDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min`
}
