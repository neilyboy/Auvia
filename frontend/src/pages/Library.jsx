import { useState, useEffect } from 'react'
import { Disc3, Music, Users, Filter } from 'lucide-react'
import AlbumCard from '../components/AlbumCard'
import TrackItem from '../components/TrackItem'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import toast from 'react-hot-toast'

export default function Library() {
  const [activeTab, setActiveTab] = useState('albums')
  const [albums, setAlbums] = useState([])
  const [tracks, setTracks] = useState([])
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const { setQueue, addToQueue } = usePlayerStore()

  useEffect(() => {
    fetchLibrary()
  }, [activeTab])

  const fetchLibrary = async () => {
    setLoading(true)
    try {
      if (activeTab === 'albums') {
        const response = await api.get('/music/albums', {
          params: { downloaded_only: true, limit: 50 }
        })
        setAlbums(response.data)
      } else if (activeTab === 'artists') {
        const response = await api.get('/music/artists', {
          params: { limit: 50 }
        })
        setArtists(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch library:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAlbum = async (album) => {
    try {
      const response = await api.get(`/music/albums/${album.id}`)
      if (response.data.tracks?.length > 0) {
        setQueue(response.data.tracks)
        toast.success(`Playing ${album.title}`)
      }
    } catch (error) {
      toast.error('Failed to play album')
    }
  }

  const handlePlayTrack = (track) => {
    setQueue([track])
  }

  const tabs = [
    { id: 'albums', label: 'Albums', icon: Disc3 },
    { id: 'artists', label: 'Artists', icon: Users },
  ]

  return (
    <div className="p-4 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Library</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-auvia-accent text-white'
                  : 'bg-auvia-card text-auvia-muted hover:text-white'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-auvia-card rounded-xl mb-2" />
              <div className="h-4 bg-auvia-card rounded w-3/4 mb-1" />
              <div className="h-3 bg-auvia-card rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : activeTab === 'albums' ? (
        albums.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {albums.map((album) => (
              <AlbumCard 
                key={album.id}
                album={album}
                onPlay={handlePlayAlbum}
              />
            ))}
          </div>
        ) : (
          <EmptyState 
            icon={Disc3}
            title="No albums yet"
            description="Downloaded albums will appear here"
          />
        )
      ) : activeTab === 'artists' ? (
        artists.length > 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artists.map((artist) => (
              <div 
                key={artist.id}
                className="text-center cursor-pointer touch-feedback"
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
        ) : (
          <EmptyState 
            icon={Users}
            title="No artists yet"
            description="Artists from downloaded music will appear here"
          />
        )
      ) : null}
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="text-center py-20">
      <Icon size={48} className="mx-auto text-auvia-muted/50 mb-4" />
      <p className="text-auvia-muted text-lg">{title}</p>
      <p className="text-auvia-muted/70 text-sm mt-1">{description}</p>
    </div>
  )
}
