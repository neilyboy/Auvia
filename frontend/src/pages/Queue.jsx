import { useState, useEffect } from 'react'
import { Play, Pause, Trash2, GripVertical, ListX } from 'lucide-react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { usePlayerStore } from '../stores/playerStore'
import api, { API_URL } from '../services/api'
import toast from 'react-hot-toast'

// Get cover URL - prefer local endpoint for downloaded tracks
const getCoverUrl = (track) => {
  if (!track) return null
  if (track.is_downloaded && track.album_id) {
    return `${API_URL}/api/music/cover/${track.album_id}`
  }
  return track.cover_art_url
}

export default function Queue() {
  const { 
    queue, 
    queueIndex, 
    currentTrack,
    isPlaying,
    playTrackFromQueue,
    removeFromQueue,
    clearQueue,
    toggle
  } = usePlayerStore()

  const [localQueue, setLocalQueue] = useState(queue)

  useEffect(() => {
    setLocalQueue(queue)
  }, [queue])

  const handleReorder = (newOrder) => {
    setLocalQueue(newOrder)
    // TODO: Sync with backend
  }

  const upNext = localQueue.slice(queueIndex + 1)
  const history = localQueue.slice(0, queueIndex)

  return (
    <div className="p-4 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Queue</h1>
        {queue.length > 0 && (
          <button
            onClick={() => {
              clearQueue()
              toast.success('Queue cleared')
            }}
            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 touch-feedback"
          >
            <ListX size={18} />
            Clear
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-20">
          <ListX size={48} className="mx-auto text-auvia-muted/50 mb-4" />
          <p className="text-auvia-muted text-lg">Queue is empty</p>
          <p className="text-auvia-muted/70 text-sm mt-1">
            Add songs from search or your library
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Now Playing */}
          {currentTrack && (
            <section>
              <h2 className="text-sm font-semibold text-auvia-muted uppercase tracking-wider mb-3">
                Now Playing
              </h2>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 p-4 bg-auvia-accent/10 rounded-xl border border-auvia-accent/20"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  {getCoverUrl(currentTrack) ? (
                    <img 
                      src={getCoverUrl(currentTrack)} 
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-auvia-card flex items-center justify-center">
                      <span className="text-2xl">🎵</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{currentTrack.title}</p>
                  <p className="text-auvia-muted text-sm truncate">{currentTrack.artist_name}</p>
                </div>
                <button
                  onClick={toggle}
                  className="p-3 bg-auvia-accent rounded-full text-white touch-feedback"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
              </motion.div>
            </section>
          )}

          {/* Up Next */}
          {upNext.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-auvia-muted uppercase tracking-wider mb-3">
                Up Next ({upNext.length})
              </h2>
              <Reorder.Group 
                axis="y" 
                values={upNext} 
                onReorder={(newOrder) => {
                  const newQueue = [...history, currentTrack, ...newOrder]
                  setLocalQueue(newQueue)
                }}
                className="space-y-1"
              >
                <AnimatePresence>
                  {upNext.map((track, index) => (
                    <Reorder.Item
                      key={track.id || track.qobuz_id || index}
                      value={track}
                      className="flex items-center gap-3 p-3 bg-auvia-card/50 rounded-xl cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical size={18} className="text-auvia-muted flex-shrink-0" />
                      
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                        {getCoverUrl(track) ? (
                          <img 
                            src={getCoverUrl(track)} 
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-auvia-border flex items-center justify-center">
                            <span className="text-lg">🎵</span>
                          </div>
                        )}
                      </div>
                      
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => playTrackFromQueue(queueIndex + 1 + index)}
                      >
                        <p className="text-white font-medium truncate text-sm">{track.title}</p>
                        <p className="text-auvia-muted text-xs truncate">{track.artist_name}</p>
                      </div>
                      
                      <span className="text-auvia-muted text-xs">
                        {track.duration_formatted || formatDuration(track.duration)}
                      </span>
                      
                      <button
                        onClick={() => removeFromQueue(queueIndex + 1 + index)}
                        className="p-2 text-auvia-muted hover:text-red-400 touch-feedback"
                      >
                        <Trash2 size={16} />
                      </button>
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            </section>
          )}

          {/* History */}
          {history.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-auvia-muted uppercase tracking-wider mb-3">
                History ({history.length})
              </h2>
              <div className="space-y-1 opacity-60">
                {history.map((track, index) => (
                  <div
                    key={track.id || track.qobuz_id || index}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-auvia-card/30"
                    onClick={() => playTrackFromQueue(index)}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                      {getCoverUrl(track) ? (
                        <img 
                          src={getCoverUrl(track)} 
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-auvia-border flex items-center justify-center">
                          <span className="text-lg">🎵</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate text-sm">{track.title}</p>
                      <p className="text-auvia-muted text-xs truncate">{track.artist_name}</p>
                    </div>
                    
                    <span className="text-auvia-muted text-xs">
                      {track.duration_formatted || formatDuration(track.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
