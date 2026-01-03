import { Play, Pause, MoreHorizontal, Plus, Check, Download } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePlayerStore } from '../stores/playerStore'

export default function TrackItem({ 
  track, 
  index, 
  showAlbum = false,
  onPlay,
  onAddToQueue 
}) {
  const { currentTrack, isPlaying, toggle } = usePlayerStore()
  
  const isCurrentTrack = currentTrack?.id === track.id || 
    (currentTrack?.qobuz_id && currentTrack.qobuz_id === track.qobuz_id)

  const handlePlay = () => {
    if (isCurrentTrack) {
      toggle()
    } else if (onPlay) {
      onPlay(track)
    }
  }

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className={`flex items-center gap-3 p-3 rounded-xl touch-feedback cursor-pointer ${
        isCurrentTrack ? 'bg-auvia-accent/10' : 'hover:bg-auvia-card/50'
      }`}
      onClick={handlePlay}
    >
      {/* Track Number / Now Playing Indicator */}
      <div className="w-8 flex-shrink-0 text-center">
        {isCurrentTrack && isPlaying ? (
          <div className="flex items-end justify-center gap-0.5 h-4">
            <div className="w-1 bg-auvia-accent rounded-full now-playing-bar" />
            <div className="w-1 bg-auvia-accent rounded-full now-playing-bar" />
            <div className="w-1 bg-auvia-accent rounded-full now-playing-bar" />
          </div>
        ) : (
          <span className={`text-sm ${isCurrentTrack ? 'text-auvia-accent' : 'text-auvia-muted'}`}>
            {index !== undefined ? index + 1 : ''}
          </span>
        )}
      </div>

      {/* Cover Art (if showing album info) */}
      {showAlbum && track.cover_art_url && (
        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
          <img 
            src={track.cover_art_url} 
            alt={track.album_title || track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate text-sm ${isCurrentTrack ? 'text-auvia-accent' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="text-auvia-muted text-xs truncate">
          {track.artist_name}
          {showAlbum && track.album_title && ` • ${track.album_title}`}
        </p>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-2">
        {track.is_downloaded ? (
          <Check size={14} className="text-green-500" />
        ) : (
          <Download size={14} className="text-auvia-muted" />
        )}
      </div>

      {/* Duration */}
      <span className="text-auvia-muted text-xs w-10 text-right flex-shrink-0">
        {track.duration_formatted || formatDuration(track.duration)}
      </span>

      {/* Add to Queue */}
      {onAddToQueue && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
          className="p-2 text-auvia-muted hover:text-white touch-feedback"
        >
          <Plus size={18} />
        </button>
      )}
    </motion.div>
  )
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
