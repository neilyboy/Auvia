import { create } from 'zustand'
import api from '../services/api'

export const useLikesStore = create((set, get) => ({
  likedTrackIds: new Set(),
  likedAlbumIds: new Set(),
  isLoading: false,

  // Fetch all liked IDs on app init
  fetchLikedIds: async () => {
    try {
      const [tracksRes, albumsRes] = await Promise.all([
        api.get('/likes/tracks/ids'),
        api.get('/likes/albums/ids')
      ])
      set({
        likedTrackIds: new Set(tracksRes.data.track_ids || []),
        likedAlbumIds: new Set(albumsRes.data.album_ids || [])
      })
    } catch (error) {
      console.error('Failed to fetch liked IDs:', error)
    }
  },

  // Check if a track is liked
  isTrackLiked: (trackId) => {
    return get().likedTrackIds.has(trackId)
  },

  // Check if an album is liked
  isAlbumLiked: (albumId) => {
    return get().likedAlbumIds.has(albumId)
  },

  // Toggle track like
  toggleTrackLike: async (trackId) => {
    const { likedTrackIds } = get()
    const isLiked = likedTrackIds.has(trackId)
    
    // Optimistic update
    const newSet = new Set(likedTrackIds)
    if (isLiked) {
      newSet.delete(trackId)
    } else {
      newSet.add(trackId)
    }
    set({ likedTrackIds: newSet })
    
    try {
      if (isLiked) {
        await api.delete(`/likes/track/${trackId}`)
      } else {
        await api.post(`/likes/track/${trackId}`)
      }
      return !isLiked
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle track like:', error)
      set({ likedTrackIds })
      return isLiked
    }
  },

  // Toggle album like
  toggleAlbumLike: async (albumId) => {
    const { likedAlbumIds } = get()
    const isLiked = likedAlbumIds.has(albumId)
    
    // Optimistic update
    const newSet = new Set(likedAlbumIds)
    if (isLiked) {
      newSet.delete(albumId)
    } else {
      newSet.add(albumId)
    }
    set({ likedAlbumIds: newSet })
    
    try {
      if (isLiked) {
        await api.delete(`/likes/album/${albumId}`)
      } else {
        await api.post(`/likes/album/${albumId}`)
      }
      return !isLiked
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle album like:', error)
      set({ likedAlbumIds })
      return isLiked
    }
  },

  // Get liked tracks (full data)
  fetchLikedTracks: async () => {
    set({ isLoading: true })
    try {
      const response = await api.get('/likes/tracks')
      set({ isLoading: false })
      return response.data
    } catch (error) {
      console.error('Failed to fetch liked tracks:', error)
      set({ isLoading: false })
      return []
    }
  },

  // Get liked albums (full data)
  fetchLikedAlbums: async () => {
    set({ isLoading: true })
    try {
      const response = await api.get('/likes/albums')
      set({ isLoading: false })
      return response.data
    } catch (error) {
      console.error('Failed to fetch liked albums:', error)
      set({ isLoading: false })
      return []
    }
  }
}))
