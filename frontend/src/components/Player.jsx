import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Play, Pause, SkipBack, SkipForward, 
  ChevronUp, ChevronDown, Volume2, VolumeX,
  Repeat, Shuffle, ListMusic
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '../stores/playerStore'
import { API_URL } from '../services/api'

// Get cover URL - prefer local endpoint for downloaded tracks
const getCoverUrl = (track) => {
  if (!track) return null
  // Use album cover endpoint if track has album info from local DB
  if (track.is_downloaded && track.id) {
    // Try to get album_id from track, or use a search
    return `${API_URL}/api/music/cover/${track.album_id || 0}`
  }
  return track.cover_art_url
}

export default function Player() {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  
  const {
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    volume,
    toggle,
    playNext,
    playPrevious,
    seek,
    setVolume,
    formatTime
  } = usePlayerStore()

  if (!currentTrack) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    seek(percent * duration)
  }

  return (
    <>
      {/* Mini Player */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-16 left-0 right-0 bg-auvia-card/95 backdrop-blur-lg border-t border-auvia-border z-30"
          >
            {/* Progress bar */}
            <div 
              className="h-1 bg-auvia-border cursor-pointer"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-auvia-accent transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="flex items-center px-4 py-2 gap-3">
              {/* Album Art */}
              <div 
                className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => setExpanded(true)}
              >
                {getCoverUrl(currentTrack) ? (
                  <img 
                    src={getCoverUrl(currentTrack)} 
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-auvia-border flex items-center justify-center">
                    <span className="text-2xl">🎵</span>
                  </div>
                )}
              </div>
              
              {/* Track Info */}
              <div 
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => setExpanded(true)}
              >
                <p className="text-white font-medium truncate text-sm">
                  {currentTrack.title}
                </p>
                <p className="text-auvia-muted text-xs truncate">
                  {currentTrack.artist_name}
                </p>
              </div>
              
              {/* Controls */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={playPrevious}
                  className="p-2 text-auvia-light touch-feedback"
                >
                  <SkipBack size={20} />
                </button>
                <button 
                  onClick={toggle}
                  className="p-3 bg-auvia-accent rounded-full text-white touch-feedback"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <button 
                  onClick={playNext}
                  className="p-2 text-auvia-light touch-feedback"
                >
                  <SkipForward size={20} />
                </button>
              </div>
              
              {/* Expand Button */}
              <button 
                onClick={() => setExpanded(true)}
                className="p-2 text-auvia-muted touch-feedback"
              >
                <ChevronUp size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Player */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 bg-auvia-darker z-50 flex flex-col safe-area-top safe-area-bottom"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
              <button 
                onClick={() => setExpanded(false)}
                className="p-2 text-auvia-muted touch-feedback"
              >
                <ChevronDown size={24} />
              </button>
              <span className="text-auvia-muted text-sm font-medium">Now Playing</span>
              <button 
                onClick={() => { setExpanded(false); navigate('/queue'); }}
                className="p-2 text-auvia-muted touch-feedback"
              >
                <ListMusic size={24} />
              </button>
            </div>

            {/* Album Art */}
            <div className="flex-1 flex items-center justify-center px-8 py-4">
              <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden shadow-2xl">
                {getCoverUrl(currentTrack) ? (
                  <img 
                    src={getCoverUrl(currentTrack)} 
                    alt={currentTrack.title}
                    className={`w-full h-full object-cover ${isPlaying ? 'vinyl-spin' : 'vinyl-spin paused'}`}
                  />
                ) : (
                  <div className="w-full h-full bg-auvia-card flex items-center justify-center">
                    <span className="text-8xl">🎵</span>
                  </div>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="px-8 py-4 text-center">
              <h2 className="text-2xl font-bold text-white truncate">
                {currentTrack.title}
              </h2>
              <p className="text-auvia-muted text-lg mt-1 truncate">
                {currentTrack.artist_name}
              </p>
              {currentTrack.album_title && (
                <p className="text-auvia-muted/70 text-sm mt-1 truncate">
                  {currentTrack.album_title}
                </p>
              )}
            </div>

            {/* Progress */}
            <div className="px-8 py-4">
              <div 
                className="h-2 bg-auvia-border rounded-full cursor-pointer overflow-hidden"
                onClick={handleProgressClick}
              >
                <div 
                  className="h-full bg-auvia-accent rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-auvia-muted">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="px-8 py-4">
              <div className="flex items-center justify-center gap-6">
                <button className="p-3 text-auvia-muted touch-feedback">
                  <Shuffle size={22} />
                </button>
                <button 
                  onClick={playPrevious}
                  className="p-3 text-white touch-feedback"
                >
                  <SkipBack size={28} />
                </button>
                <button 
                  onClick={toggle}
                  className="p-5 bg-auvia-accent rounded-full text-white touch-feedback glow"
                >
                  {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                </button>
                <button 
                  onClick={playNext}
                  className="p-3 text-white touch-feedback"
                >
                  <SkipForward size={28} />
                </button>
                <button className="p-3 text-auvia-muted touch-feedback">
                  <Repeat size={22} />
                </button>
              </div>
            </div>

            {/* Volume */}
            <div className="px-8 py-4 flex items-center gap-4">
              <button 
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className="text-auvia-muted touch-feedback"
              >
                {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 progress-bar"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
