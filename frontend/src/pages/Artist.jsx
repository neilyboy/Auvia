import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play } from 'lucide-react'
import AlbumCard from '../components/AlbumCard'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import toast from 'react-hot-toast'

export default function Artist() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [artist, setArtist] = useState(null)
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const { setQueue } = usePlayerStore()

  useEffect(() => {
    fetchArtist()
  }, [id])

  const fetchArtist = async () => {
    setLoading(true)
    try {
      // Check if this is a Qobuz artist (remote)
      if (id.startsWith('qobuz:')) {
        const artistName = decodeURIComponent(id.replace('qobuz:', ''))
        // Search for artist albums from Qobuz
        const searchRes = await api.get('/search/albums', {
          params: { q: artistName, limit: 20 }
        })
        // Filter albums by this artist
        const artistAlbums = searchRes.data.filter(
          album => album.artist_name?.toLowerCase() === artistName.toLowerCase()
        )
        
        setArtist({
          name: artistName,
          qobuz_id: null,
          image_url: artistAlbums[0]?.cover_art_url || null
        })
        setAlbums(artistAlbums.length > 0 ? artistAlbums : searchRes.data)
      } else {
        // Local artist
        const [artistRes, albumsRes] = await Promise.all([
          api.get(`/music/artists/${id}`),
          api.get(`/music/artists/${id}/albums`)
        ])
        setArtist(artistRes.data)
        setAlbums(albumsRes.data)
      }
    } catch (error) {
      console.error('Failed to fetch artist:', error)
      toast.error('Failed to load artist')
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

  if (loading) {
    return (
      <div className="p-4 pt-8 animate-pulse">
        <div className="h-8 w-8 bg-auvia-card rounded mb-6" />
        <div className="flex flex-col items-center mb-8">
          <div className="w-40 h-40 bg-auvia-card rounded-full mb-4" />
          <div className="h-8 bg-auvia-card rounded w-48 mb-2" />
          <div className="h-4 bg-auvia-card rounded w-24" />
        </div>
      </div>
    )
  }

  if (!artist) {
    return (
      <div className="p-4 pt-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-auvia-muted touch-feedback">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center py-20">
          <p className="text-auvia-muted text-lg">Artist not found</p>
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

      {/* Artist Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-40 h-40 rounded-full overflow-hidden mb-4 shadow-2xl">
          {artist.image_url ? (
            <img 
              src={artist.image_url} 
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-auvia-card flex items-center justify-center">
              <span className="text-6xl">👤</span>
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{artist.name}</h1>
        <p className="text-auvia-muted">{albums.length} albums</p>
      </div>

      {/* Albums */}
      {albums.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Albums</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {albums.map((album) => (
              <AlbumCard 
                key={album.id}
                album={album}
                onPlay={handlePlayAlbum}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="text-auvia-muted">No albums found</p>
        </div>
      )}
    </div>
  )
}
