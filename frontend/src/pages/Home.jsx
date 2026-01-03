import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import AlbumCard from '../components/AlbumCard'
import TrackItem from '../components/TrackItem'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import toast from 'react-hot-toast'

export default function Home() {
  const [trending, setTrending] = useState(null)
  const [loading, setLoading] = useState(true)
  const { setQueue, addToQueue } = usePlayerStore()

  useEffect(() => {
    fetchTrending()
  }, [])

  const fetchTrending = async () => {
    setLoading(true)
    try {
      const response = await api.get('/music/trending')
      setTrending(response.data)
    } catch (error) {
      console.error('Failed to fetch trending:', error)
      toast.error('Failed to load trending music')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAlbum = async (album) => {
    if (album.is_downloaded && album.id) {
      try {
        const response = await api.get(`/music/albums/${album.id}`)
        if (response.data.tracks?.length > 0) {
          setQueue(response.data.tracks)
          toast.success(`Playing ${album.title}`)
        }
      } catch (error) {
        toast.error('Failed to play album')
      }
    } else if (album.qobuz_url) {
      toast.loading('Downloading album...', { id: 'download' })
      try {
        await api.post('/queue/play-album', { qobuz_album_url: album.qobuz_url })
        toast.success('Album queued for download', { id: 'download' })
      } catch (error) {
        toast.error('Failed to download album', { id: 'download' })
      }
    }
  }

  const handlePlayTrack = async (track) => {
    if (track.is_downloaded && track.id) {
      setQueue([track])
    } else {
      toast.loading('Downloading...', { id: 'download' })
      try {
        await api.post('/queue/add', {
          qobuz_track_id: track.qobuz_id,
          qobuz_album_url: track.qobuz_album_url,
          play_now: true
        })
        toast.success('Track queued', { id: 'download' })
      } catch (error) {
        toast.error('Failed to queue track', { id: 'download' })
      }
    }
  }

  if (loading) {
    return (
      <div className="p-4 pt-12">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-auvia-card rounded w-32" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-40 flex-shrink-0">
                <div className="aspect-square bg-auvia-card rounded-xl mb-2" />
                <div className="h-4 bg-auvia-card rounded w-3/4 mb-1" />
                <div className="h-3 bg-auvia-card rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pt-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Auvia</h1>
          <p className="text-auvia-muted text-sm">Set the Atmosphere</p>
        </div>
        <button 
          onClick={fetchTrending}
          className="p-2 text-auvia-muted hover:text-white touch-feedback"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Recently Played */}
      {trending?.recently_played?.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Recently Played</h2>
          <div className="space-y-1">
            {trending.recently_played.slice(0, 5).map((track, index) => (
              <TrackItem 
                key={track.id || track.qobuz_id || index}
                track={track}
                index={index}
                showAlbum
                onPlay={handlePlayTrack}
                onAddToQueue={() => addToQueue(track)}
              />
            ))}
          </div>
        </section>
      )}

      {/* New Releases */}
      {trending?.new_releases?.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">New Releases</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scroll-smooth">
            {trending.new_releases.map((album, index) => (
              <AlbumCard 
                key={album.qobuz_id || album.id || index}
                album={album}
                onPlay={handlePlayAlbum}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      {trending?.trending?.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Trending Now</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scroll-smooth">
            {trending.trending.map((album, index) => (
              <AlbumCard 
                key={album.qobuz_id || album.id || index}
                album={album}
                onPlay={handlePlayAlbum}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured / Editor's Picks */}
      {trending?.featured?.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Editor's Picks</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scroll-smooth">
            {trending.featured.map((album, index) => (
              <AlbumCard 
                key={album.qobuz_id || album.id || index}
                album={album}
                onPlay={handlePlayAlbum}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently Added (Downloaded) */}
      {trending?.recently_added?.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Recently Added</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trending.recently_added.map((album, index) => (
              <AlbumCard 
                key={album.id || index}
                album={album}
                onPlay={handlePlayAlbum}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!trending?.new_releases?.length && 
       !trending?.trending?.length && 
       !trending?.recently_played?.length && (
        <div className="text-center py-20">
          <p className="text-auvia-muted text-lg">No music yet</p>
          <p className="text-auvia-muted/70 text-sm mt-1">
            Search for music to get started
          </p>
        </div>
      )}
    </div>
  )
}
