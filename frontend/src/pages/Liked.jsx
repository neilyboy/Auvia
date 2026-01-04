import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Play, Shuffle, Clock } from 'lucide-react'
import { useLikesStore } from '../stores/likesStore'
import { usePlayerStore } from '../stores/playerStore'
import TrackItem from '../components/TrackItem'
import toast from 'react-hot-toast'

export default function Liked() {
  const navigate = useNavigate()
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const fetchLikedTracks = useLikesStore((state) => state.fetchLikedTracks)
  const setQueue = usePlayerStore((state) => state.setQueue)
  const addToQueue = usePlayerStore((state) => state.addToQueue)
  const currentTrack = usePlayerStore((state) => state.currentTrack)

  useEffect(() => {
    loadTracks()
  }, [])

  const loadTracks = async () => {
    setLoading(true)
    const data = await fetchLikedTracks()
    setTracks(data)
    setLoading(false)
  }

  const handlePlayAll = () => {
    const downloadedTracks = tracks.filter(t => t.is_downloaded)
    if (downloadedTracks.length === 0) {
      toast.error('No downloaded tracks to play')
      return
    }
    setQueue(downloadedTracks)
    navigate('/queue')
  }

  const handleShuffle = () => {
    const downloadedTracks = tracks.filter(t => t.is_downloaded)
    if (downloadedTracks.length === 0) {
      toast.error('No downloaded tracks to play')
      return
    }
    const shuffled = [...downloadedTracks].sort(() => Math.random() - 0.5)
    setQueue(shuffled)
    navigate('/queue')
  }

  const handlePlayTrack = (track, index) => {
    if (!track.is_downloaded) {
      toast.error('Track not downloaded')
      return
    }
    // Play from this track onwards
    const downloadedTracks = tracks.filter(t => t.is_downloaded)
    const trackIndex = downloadedTracks.findIndex(t => t.id === track.id)
    if (trackIndex >= 0) {
      setQueue(downloadedTracks, trackIndex)
    }
  }

  const handleAddToQueue = (track) => {
    if (!track.is_downloaded) {
      toast.error('Track not downloaded')
      return
    }
    addToQueue(track)
    toast.success('Added to queue')
  }

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0)
  const formatTotalDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours} hr ${mins} min`
    return `${mins} min`
  }

  if (loading) {
    return (
      <div className="p-4 pb-32">
        <div className="animate-pulse">
          <div className="h-48 bg-auvia-card rounded-lg mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-auvia-card rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-32">
      {/* Header */}
      <div className="flex items-end gap-6 mb-6">
        <div className="w-48 h-48 bg-gradient-to-br from-purple-700 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-xl">
          <Heart size={80} className="text-white" fill="white" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-auvia-muted uppercase tracking-wider mb-1">Playlist</p>
          <h1 className="text-4xl font-bold text-white mb-2">Liked Songs</h1>
          <div className="flex items-center gap-3 text-auvia-muted text-sm mb-4">
            <span>{tracks.length} songs</span>
            {totalDuration > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatTotalDuration(totalDuration)}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          {tracks.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-6 py-3 bg-auvia-accent rounded-full text-white font-medium"
              >
                <Play size={18} className="ml-0.5" />
                Play
              </button>
              <button
                onClick={handleShuffle}
                className="flex items-center gap-2 px-6 py-3 bg-auvia-card rounded-full text-white font-medium"
              >
                <Shuffle size={18} />
                Shuffle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Track List */}
      {tracks.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={64} className="mx-auto text-auvia-muted mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No liked songs yet</h2>
          <p className="text-auvia-muted">
            Tap the heart icon on any song to add it to your liked songs
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {tracks.map((track, index) => (
            <TrackItem
              key={track.id}
              track={track}
              index={index}
              onPlay={() => handlePlayTrack(track, index)}
              onAddToQueue={() => handleAddToQueue(track)}
              showLikeButton={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}
