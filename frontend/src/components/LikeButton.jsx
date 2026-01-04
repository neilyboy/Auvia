import { Heart } from 'lucide-react'
import { useLikesStore } from '../stores/likesStore'

export default function LikeButton({ trackId, albumId, size = 20, className = '' }) {
  const isTrackLiked = useLikesStore((state) => state.isTrackLiked)
  const isAlbumLiked = useLikesStore((state) => state.isAlbumLiked)
  const toggleTrackLike = useLikesStore((state) => state.toggleTrackLike)
  const toggleAlbumLike = useLikesStore((state) => state.toggleAlbumLike)

  const isLiked = trackId ? isTrackLiked(trackId) : albumId ? isAlbumLiked(albumId) : false

  const handleClick = async (e) => {
    e.stopPropagation()
    e.preventDefault()
    
    if (trackId) {
      await toggleTrackLike(trackId)
    } else if (albumId) {
      await toggleAlbumLike(albumId)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${
        isLiked 
          ? 'text-red-500 hover:text-red-400' 
          : 'text-auvia-muted hover:text-white'
      } ${className}`}
      title={isLiked ? 'Remove from Liked' : 'Add to Liked'}
    >
      <Heart 
        size={size} 
        fill={isLiked ? 'currentColor' : 'none'}
        className="transition-all duration-200"
      />
    </button>
  )
}
