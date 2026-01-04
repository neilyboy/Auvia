import { useNavigate } from 'react-router-dom'
import { Play, Download, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { API_URL } from '../services/api'
import LazyImage from './LazyImage'

export default function AlbumCard({ album, onPlay, compact = false }) {
  const navigate = useNavigate()
  
  // Use local cover endpoint for downloaded albums, otherwise use remote URL
  const getCoverUrl = () => {
    if (album.is_downloaded && album.id) {
      return `${API_URL}/api/music/cover/${album.id}`
    }
    return album.cover_art_url
  }
  
  const coverUrl = getCoverUrl()

  const handleClick = () => {
    if (album.id) {
      navigate(`/album/${album.id}`)
    } else if (album.qobuz_id) {
      navigate(`/album/qobuz-${album.qobuz_id}`)
    }
  }

  if (compact) {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 p-2 rounded-xl bg-auvia-card/50 touch-feedback cursor-pointer"
        onClick={handleClick}
      >
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 relative group">
          <LazyImage
            src={coverUrl}
            alt={album.title}
            className="w-full h-full"
            fallback={
              <div className="w-full h-full bg-auvia-border flex items-center justify-center">
                <span className="text-2xl">💿</span>
              </div>
            }
          />
          {onPlay && (
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(album); }}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <Play size={20} className="text-white" />
            </button>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate text-sm">{album.title}</p>
          <p className="text-auvia-muted text-xs truncate">{album.artist_name}</p>
        </div>
        {album.is_downloaded && (
          <Check size={16} className="text-green-500 flex-shrink-0" />
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className="flex-shrink-0 w-40 md:w-44 touch-feedback cursor-pointer"
      onClick={handleClick}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden mb-2 group shadow-lg">
        <LazyImage
          src={coverUrl}
          alt={album.title}
          className="w-full h-full"
          fallback={
            <div className="w-full h-full bg-auvia-card flex items-center justify-center">
              <span className="text-5xl">💿</span>
            </div>
          }
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Play button */}
        {onPlay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(album); }}
            className="absolute bottom-2 right-2 p-3 bg-auvia-accent rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-lg"
          >
            <Play size={18} className="text-white ml-0.5" />
          </button>
        )}
        
        {/* Downloaded indicator */}
        {album.is_downloaded && (
          <div className="absolute top-2 right-2 p-1.5 bg-green-500/90 rounded-full">
            <Check size={12} className="text-white" />
          </div>
        )}
      </div>
      
      <h3 className="text-white font-medium truncate text-sm">{album.title}</h3>
      <p className="text-auvia-muted text-xs truncate">{album.artist_name}</p>
      {album.release_date && (
        <p className="text-auvia-muted/70 text-xs">{album.release_date.slice(0, 4)}</p>
      )}
    </motion.div>
  )
}
