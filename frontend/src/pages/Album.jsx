import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Shuffle, Download, Check, Clock, HardDriveDownload } from 'lucide-react'
import TrackItem from '../components/TrackItem'
import PlayActionModal from '../components/PlayActionModal'
import DownloadQualityModal from '../components/DownloadQualityModal'
import api, { API_URL } from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import { useDownloadStore } from '../stores/downloadStore'
import toast from 'react-hot-toast'

export default function Album() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [playAfterDownload, setPlayAfterDownload] = useState(false)
  const { setQueue, addToQueue, addTracksToQueue, addTracksToQueueNext, currentTrack } = usePlayerStore()
  const { addDownload, removeDownload } = useDownloadStore()
  const [playActionModal, setPlayActionModal] = useState({ open: false, tracks: null })
  const [directDownloadEnabled, setDirectDownloadEnabled] = useState(false)
  const [downloadQualityModal, setDownloadQualityModal] = useState(false)
  const [directDownloading, setDirectDownloading] = useState(false)
  const [pendingTrack, setPendingTrack] = useState(null) // Track to play/queue after download
  const [pendingAction, setPendingAction] = useState(null) // 'play' or 'queue'

  useEffect(() => {
    fetchAlbum()
    checkDirectDownloadEnabled()
  }, [id])

  const checkDirectDownloadEnabled = async () => {
    try {
      const response = await api.get('/music/direct-download-enabled')
      setDirectDownloadEnabled(response.data.enabled)
    } catch (error) {
      setDirectDownloadEnabled(false)
    }
  }

  const handleDirectDownload = async (quality) => {
    if (!album?.qobuz_url) {
      toast.error('Album URL not available')
      return
    }
    
    const qualityNames = { 1: 'MP3', 2: 'CD Quality', 3: 'Hi-Res', 4: 'Hi-Res+' }
    const qualityName = qualityNames[quality] || 'audio'
    
    setDirectDownloading(true)
    setDownloadQualityModal(false)
    
    // Show initial toast with quality info
    toast.loading(`Downloading ${qualityName} from Qobuz...`, { id: 'direct-download' })
    
    // Progress message rotation for long downloads
    const progressMessages = [
      `Downloading ${qualityName} tracks...`,
      'Fetching audio files...',
      'This may take a few minutes for large albums...',
      `Packaging ${qualityName} files...`,
      'Almost there, creating ZIP...',
    ]
    let messageIndex = 0
    const progressInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % progressMessages.length
      toast.loading(progressMessages[messageIndex], { id: 'direct-download' })
    }, 8000) // Rotate message every 8 seconds
    
    try {
      const response = await api.post('/music/direct-download', null, {
        params: { qobuz_url: album.qobuz_url, quality },
        responseType: 'blob',
        timeout: 600000 // 10 minute timeout for large albums
      })
      
      clearInterval(progressInterval)
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from content-disposition header or use album title
      const contentDisposition = response.headers['content-disposition']
      let filename = `${album.title} [${qualityName}].zip`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }
      
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success(`${qualityName} download complete!`, { id: 'direct-download' })
    } catch (error) {
      clearInterval(progressInterval)
      console.error('Direct download failed:', error)
      if (error.response?.status === 403) {
        toast.error('Direct downloads are disabled', { id: 'direct-download' })
      } else {
        toast.error('Download failed - please try again', { id: 'direct-download' })
      }
    } finally {
      setDirectDownloading(false)
    }
  }
  
  // Poll for download completion
  useEffect(() => {
    let pollInterval
    if (downloading && album?.qobuz_id) {
      pollInterval = setInterval(async () => {
        try {
          // Use the by-qobuz endpoint which triggers a scan and finds by qobuz_id or title+artist
          const params = {}
          if (album.title) params.title = album.title
          if (album.artist_name) params.artist = album.artist_name
          const response = await api.get(`/music/albums/by-qobuz/${album.qobuz_id}`, { params })
          if (response.data?.found && response.data?.album?.is_downloaded && response.data?.album?.tracks?.length > 0) {
            const downloadedAlbum = response.data.album
            setAlbum(downloadedAlbum)
            setDownloading(false)
            removeDownload(album.qobuz_id || id)
            
            // Handle pending track action (single track download and play/queue)
            if (pendingTrack && pendingAction) {
              // Find the downloaded track by matching qobuz_id or title
              const downloadedTrack = downloadedAlbum.tracks.find(
                t => t.qobuz_id === pendingTrack.qobuz_id || 
                     t.title.toLowerCase() === pendingTrack.title.toLowerCase()
              )
              
              if (downloadedTrack) {
                if (pendingAction === 'play') {
                  toast.success(`Now playing "${downloadedTrack.title}"`, { id: 'track-download' })
                  setQueue([downloadedTrack])
                } else if (pendingAction === 'queue') {
                  toast.success(`Added "${downloadedTrack.title}" to queue`, { id: 'track-download' })
                  addToQueue(downloadedTrack)
                }
              } else {
                toast.error('Track not found after download', { id: 'track-download' })
              }
              
              setPendingTrack(null)
              setPendingAction(null)
            } else if (playAfterDownload && downloadedAlbum.tracks?.length > 0) {
              // Full album play was requested
              toast.success('Download complete!', { id: 'download' })
              setQueue(downloadedAlbum.tracks)
              setPlayAfterDownload(false)
              navigate('/queue')
            } else {
              toast.success('Download complete!', { id: 'download' })
              toast.dismiss('track-download')
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
  }, [downloading, album?.qobuz_id, playAfterDownload, pendingTrack, pendingAction, navigate, setQueue, addToQueue, removeDownload, id])

  const fetchAlbum = async () => {
    setLoading(true)
    try {
      // Check if it's a Qobuz ID or local ID
      if (id.startsWith('qobuz-')) {
        const qobuzId = id.replace('qobuz-', '')
        
        // First check if we have a local copy
        try {
          const localResponse = await api.get(`/music/albums/by-qobuz/${qobuzId}`)
          if (localResponse.data?.found && localResponse.data?.album?.is_downloaded) {
            // Use local version - it has tracks
            setAlbum(localResponse.data.album)
            setLoading(false)
            return
          }
        } catch (e) {
          // No local copy, continue to fetch from Qobuz
        }
        
        // Fetch full album details including tracks from Qobuz API
        try {
          const qobuzResponse = await api.get(`/music/albums/qobuz/${qobuzId}`)
          if (qobuzResponse.data) {
            setAlbum(qobuzResponse.data)
          }
        } catch (e) {
          console.error('Could not fetch Qobuz album info:', e)
          toast.error('Failed to load album from Qobuz')
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
    // Check if album is downloaded (has local tracks with IDs)
    const hasDownloadedTracks = album?.is_downloaded && album?.tracks?.some(t => t.id && t.is_downloaded)
    
    if (hasDownloadedTracks) {
      // If something is playing, show action modal
      if (currentTrack) {
        setPlayActionModal({ open: true, tracks: album.tracks })
      } else {
        setQueue(album.tracks)
        toast.success(`Playing ${album.title}`)
        navigate('/queue')
      }
    } else if (album?.qobuz_url) {
      // Download and play when ready
      setPlayAfterDownload(true)
      await handleDownload()
    }
  }

  const handleShuffle = async () => {
    const hasDownloadedTracks = album?.is_downloaded && album?.tracks?.some(t => t.id && t.is_downloaded)
    
    if (hasDownloadedTracks) {
      const shuffled = [...album.tracks].sort(() => Math.random() - 0.5)
      setQueue(shuffled)
      toast.success(`Shuffling ${album.title}`)
    } else if (album?.qobuz_url) {
      // Download first, then shuffle will work after refresh
      setPlayAfterDownload(true)
      await handleDownload()
    }
  }

  const handleDownload = async () => {
    if (!album?.qobuz_url || downloading) return
    
    const downloadId = album.qobuz_id || id
    setDownloading(true)
    addDownload(downloadId, null, album.title)
    toast.loading('Starting download...', { id: 'download' })
    
    try {
      await api.post('/queue/play-album', { qobuz_album_url: album.qobuz_url })
      toast.dismiss('download')
    } catch (error) {
      removeDownload(downloadId)
      toast.error('Failed to download album', { id: 'download' })
      setDownloading(false)
      setPlayAfterDownload(false)
    }
  }

  const handlePlayTrack = (track, index) => {
    // Check if track is downloaded (has file_path or is_downloaded)
    if (track.is_downloaded && track.file_path) {
      // Track is available locally - play it
      if (currentTrack) {
        setPlayActionModal({ open: true, tracks: [track], isSingleTrack: true })
      } else {
        setQueue([track])
      }
    } else {
      // Track needs to be downloaded first
      handleDownloadAndPlay(track, 'play')
    }
  }

  const handleAddTrackToQueue = (track) => {
    // Check if track is downloaded
    if (track.is_downloaded && track.file_path) {
      addToQueue(track)
      toast.success('Added to queue')
    } else {
      // Track needs to be downloaded first
      handleDownloadAndPlay(track, 'queue')
    }
  }

  const handleDownloadAndPlay = async (track, action) => {
    if (!album?.qobuz_url) {
      toast.error('Album URL not available')
      return
    }

    const downloadId = album.qobuz_id || id
    
    // Store the pending track and action
    setPendingTrack(track)
    setPendingAction(action)
    setDownloading(true)
    addDownload(downloadId, track.title, album.title)

    try {
      // Start the album download via queue endpoint
      await api.post('/queue/play-album', {
        qobuz_album_url: album.qobuz_url
      })
      // Banner will show progress, toast dismissed
    } catch (error) {
      removeDownload(downloadId)
      console.error('Download failed:', error)
      toast.error('Failed to start download')
      setDownloading(false)
      setPendingTrack(null)
      setPendingAction(null)
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
          <p 
            className="text-auvia-muted text-lg mb-2 hover:text-white cursor-pointer transition-colors"
            onClick={() => album.artist_id ? navigate(`/artist/${album.artist_id}`) : null}
          >
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
            {directDownloadEnabled && album.qobuz_url && (
              <button
                onClick={() => setDownloadQualityModal(true)}
                disabled={directDownloading}
                className={`flex items-center gap-2 px-4 py-3 rounded-full text-white font-medium touch-feedback ${
                  directDownloading ? 'bg-green-600/50 cursor-wait' : 'bg-green-600 hover:bg-green-700'
                }`}
                title="Download to your device"
              >
                <HardDriveDownload size={18} className={directDownloading ? 'animate-pulse' : ''} />
                <span className="hidden sm:inline">{directDownloading ? 'Preparing...' : 'Save'}</span>
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
              onAddToQueue={() => handleAddTrackToQueue(track)}
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

      {/* Play Action Modal */}
      <PlayActionModal
        isOpen={playActionModal.open}
        onClose={() => setPlayActionModal({ open: false, tracks: null, isSingleTrack: false })}
        onPlayNow={() => {
          if (playActionModal.tracks) {
            setQueue(playActionModal.tracks)
            const trackName = playActionModal.isSingleTrack ? playActionModal.tracks[0]?.title : album?.title
            toast.success(`Playing ${trackName}`)
            navigate('/queue')
          }
        }}
        onAddToQueue={() => {
          if (playActionModal.tracks) {
            addTracksToQueue(playActionModal.tracks)
            const trackName = playActionModal.isSingleTrack ? `"${playActionModal.tracks[0]?.title}"` : album?.title
            toast.success(`Added ${trackName} to queue`)
          }
        }}
        onPlayNext={() => {
          if (playActionModal.tracks) {
            addTracksToQueueNext(playActionModal.tracks)
            const trackName = playActionModal.isSingleTrack ? `"${playActionModal.tracks[0]?.title}"` : album?.title
            toast.success(`${trackName} will play next`)
          }
        }}
        title={playActionModal.isSingleTrack ? "Play Track" : "Play Album"}
      />

      {/* Download Quality Modal */}
      <DownloadQualityModal
        isOpen={downloadQualityModal}
        onClose={() => setDownloadQualityModal(false)}
        onDownload={handleDirectDownload}
        albumTitle={album?.title}
        isDownloading={directDownloading}
      />
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
