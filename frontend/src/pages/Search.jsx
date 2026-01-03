import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, X, Loader2 } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import AlbumCard from '../components/AlbumCard'
import TrackItem from '../components/TrackItem'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import toast from 'react-hot-toast'

export default function Search() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const { setQueue, addToQueue } = usePlayerStore()

  const debouncedSearch = useDebouncedCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults(null)
      return
    }

    setLoading(true)
    try {
      const response = await api.get('/search', {
        params: { q: searchQuery, include_remote: true }
      })
      setResults(response.data)
    } catch (error) {
      console.error('Search failed:', error)
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }, 300)

  useEffect(() => {
    debouncedSearch(query)
  }, [query, debouncedSearch])

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
    } else if (track.qobuz_album_url) {
      toast.loading('Downloading...', { id: 'download' })
      try {
        await api.post('/queue/add', {
          qobuz_track_id: track.qobuz_id,
          qobuz_album_url: track.qobuz_album_url,
          play_now: true
        })
        toast.success('Track queued for download', { id: 'download' })
      } catch (error) {
        toast.error('Failed to queue track', { id: 'download' })
      }
    } else {
      toast.error('Cannot play - album URL not available')
    }
  }

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'albums', label: 'Albums' },
    { id: 'tracks', label: 'Tracks' },
    { id: 'artists', label: 'Artists' },
  ]

  const hasResults = results && (
    results.albums?.length > 0 || 
    results.tracks?.length > 0 || 
    results.artists?.length > 0
  )

  return (
    <div className="p-4 pt-8">
      {/* Search Input */}
      <div className="relative mb-6">
        <SearchIcon 
          size={20} 
          className="absolute left-4 top-1/2 -translate-y-1/2 text-auvia-muted" 
        />
        <input
          type="text"
          placeholder="Search for songs, albums, or artists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-12 py-4 bg-auvia-card rounded-2xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-auvia-muted hover:text-white touch-feedback"
          >
            <X size={20} />
          </button>
        )}
        {loading && (
          <Loader2 
            size={20} 
            className="absolute right-12 top-1/2 -translate-y-1/2 text-auvia-accent animate-spin" 
          />
        )}
      </div>

      {/* Tabs */}
      {hasResults && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-auvia-accent text-white'
                  : 'bg-auvia-card text-auvia-muted hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {hasResults ? (
        <div className="space-y-8">
          {/* Albums */}
          {(activeTab === 'all' || activeTab === 'albums') && results.albums?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Albums</h2>
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scroll-smooth">
                {results.albums.map((album, index) => (
                  <AlbumCard 
                    key={album.qobuz_id || album.id || index}
                    album={album}
                    onPlay={handlePlayAlbum}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Tracks */}
          {(activeTab === 'all' || activeTab === 'tracks') && results.tracks?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Tracks</h2>
              <div className="space-y-1">
                {results.tracks.map((track, index) => (
                  <TrackItem 
                    key={track.qobuz_id || track.id || index}
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

          {/* Artists */}
          {(activeTab === 'all' || activeTab === 'artists') && results.artists?.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Artists</h2>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.artists.map((artist, index) => (
                  <div 
                    key={artist.qobuz_id || artist.id || index}
                    className="text-center cursor-pointer touch-feedback"
                    onClick={() => navigate(`/artist/${artist.id || `qobuz:${encodeURIComponent(artist.name)}`}`)}
                  >
                    <div className="aspect-square rounded-full overflow-hidden mb-2 bg-auvia-card">
                      {artist.image_url ? (
                        <img 
                          src={artist.image_url} 
                          alt={artist.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">
                          👤
                        </div>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium truncate">{artist.name}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : query && !loading ? (
        <div className="text-center py-20">
          <p className="text-auvia-muted text-lg">No results found</p>
          <p className="text-auvia-muted/70 text-sm mt-1">
            Try a different search term
          </p>
        </div>
      ) : !query ? (
        <div className="text-center py-20">
          <SearchIcon size={48} className="mx-auto text-auvia-muted/50 mb-4" />
          <p className="text-auvia-muted text-lg">Search for music</p>
          <p className="text-auvia-muted/70 text-sm mt-1">
            Find your favorite songs, albums, and artists
          </p>
        </div>
      ) : null}
    </div>
  )
}
