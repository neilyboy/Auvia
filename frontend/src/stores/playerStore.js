import { create } from 'zustand'
import { Howl } from 'howler'
import api, { API_URL } from '../services/api'

// Helper to get cover art URL
const getCoverArtUrl = (track) => {
  if (!track) return null
  if (track.is_downloaded && track.album_id) {
    return `${API_URL}/api/music/cover/${track.album_id}`
  }
  return track.cover_art_url || null
}

// Update Media Session metadata and handlers
const updateMediaSession = (track, isPlaying, actions) => {
  if (!('mediaSession' in navigator)) return
  
  try {
    // Set metadata
    if (track) {
      const artwork = []
      const coverUrl = getCoverArtUrl(track)
      if (coverUrl) {
        artwork.push({ src: coverUrl, sizes: '512x512', type: 'image/jpeg' })
      }
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Unknown Title',
        artist: track.artist_name || 'Unknown Artist',
        album: track.album_title || 'Unknown Album',
        artwork: artwork
      })
    }
    
    // Set playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    
    // Register action handlers
    if (actions) {
      navigator.mediaSession.setActionHandler('play', actions.play)
      navigator.mediaSession.setActionHandler('pause', actions.pause)
      navigator.mediaSession.setActionHandler('previoustrack', actions.previous)
      navigator.mediaSession.setActionHandler('nexttrack', actions.next)
      navigator.mediaSession.setActionHandler('seekto', actions.seekTo)
      navigator.mediaSession.setActionHandler('seekbackward', actions.seekBackward)
      navigator.mediaSession.setActionHandler('seekforward', actions.seekForward)
    }
  } catch (e) {
    console.log('Media Session error:', e)
  }
}

// Progress timer ID - kept outside store to avoid state update overhead
let progressIntervalId = null

// Queue persistence keys
const QUEUE_STORAGE_KEY = 'auvia_queue'
const QUEUE_INDEX_STORAGE_KEY = 'auvia_queue_index'
const CURRENT_TRACK_STORAGE_KEY = 'auvia_current_track'
const VOLUME_STORAGE_KEY = 'auvia_volume'

// Save queue to localStorage
const saveQueueToStorage = (queue, queueIndex, currentTrack) => {
  try {
    if (queue && queue.length > 0) {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
      localStorage.setItem(QUEUE_INDEX_STORAGE_KEY, String(queueIndex))
      if (currentTrack) {
        localStorage.setItem(CURRENT_TRACK_STORAGE_KEY, JSON.stringify(currentTrack))
      }
    } else {
      localStorage.removeItem(QUEUE_STORAGE_KEY)
      localStorage.removeItem(QUEUE_INDEX_STORAGE_KEY)
      localStorage.removeItem(CURRENT_TRACK_STORAGE_KEY)
    }
  } catch (e) {
    console.log('Failed to save queue to storage:', e)
  }
}

// Load queue from localStorage
const loadQueueFromStorage = () => {
  try {
    const queueStr = localStorage.getItem(QUEUE_STORAGE_KEY)
    const indexStr = localStorage.getItem(QUEUE_INDEX_STORAGE_KEY)
    const trackStr = localStorage.getItem(CURRENT_TRACK_STORAGE_KEY)
    const volumeStr = localStorage.getItem(VOLUME_STORAGE_KEY)
    
    return {
      queue: queueStr ? JSON.parse(queueStr) : [],
      queueIndex: indexStr ? parseInt(indexStr, 10) : 0,
      currentTrack: trackStr ? JSON.parse(trackStr) : null,
      volume: volumeStr ? parseFloat(volumeStr) : 0.8
    }
  } catch (e) {
    console.log('Failed to load queue from storage:', e)
    return { queue: [], queueIndex: 0, currentTrack: null, volume: 0.8 }
  }
}

// Clear Media Session (for iOS cleanup)
const clearMediaSession = () => {
  if (!('mediaSession' in navigator)) return
  
  try {
    // Set playback state to none
    navigator.mediaSession.playbackState = 'none'
    
    // Clear metadata
    navigator.mediaSession.metadata = null
    
    // Remove action handlers
    navigator.mediaSession.setActionHandler('play', null)
    navigator.mediaSession.setActionHandler('pause', null)
    navigator.mediaSession.setActionHandler('previoustrack', null)
    navigator.mediaSession.setActionHandler('nexttrack', null)
    navigator.mediaSession.setActionHandler('seekto', null)
    navigator.mediaSession.setActionHandler('seekbackward', null)
    navigator.mediaSession.setActionHandler('seekforward', null)
  } catch (e) {
    console.log('Clear Media Session error:', e)
  }
}

export const usePlayerStore = create((set, get) => ({
  // Current track
  currentTrack: null,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  volume: 0.8,
  
  // Queue
  queue: [],
  queueIndex: 0,
  
  // Howler instance
  sound: null,
  
  // Gapless playback - preloaded next track
  nextSound: null,
  nextTrack: null,
  isPreloading: false,
  
  // Loading states
  isLoading: false,
  isDownloading: false,
  downloadProgress: 0,

  setVolume: (volume) => {
    const { sound } = get()
    if (sound) {
      sound.volume(volume)
    }
    set({ volume })
    // Persist volume
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume))
    } catch (e) {}
  },

  loadTrack: async (track, autoPlay = true) => {
    const { sound } = get()
    
    // Stop progress timer first to prevent memory leak
    get().stopProgressTimer()
    
    // Stop and unload current sound
    if (sound) {
      sound.stop()
      sound.unload()
    }
    
    set({ isLoading: true, currentTrack: track })
    
    // Check if track is downloaded
    if (!track.is_downloaded && track.qobuz_album_url) {
      // Need to download first
      set({ isDownloading: true, downloadProgress: 0 })
      
      try {
        const response = await api.post('/queue/add', {
          qobuz_album_url: track.qobuz_album_url,
          qobuz_track_id: track.qobuz_id,
          play_now: true
        })
        
        // Poll for download completion
        // For now, just set a placeholder
        set({ isDownloading: false, isLoading: false })
        return
      } catch (error) {
        console.error('Download failed:', error)
        set({ isDownloading: false, isLoading: false })
        return
      }
    }
    
    // Create new Howl instance for downloaded track
    const audioUrl = `${API_URL}/api/music/stream/${track.id}`
    
    // Determine format from file extension if available
    const ext = track.file_path?.split('.').pop()?.toLowerCase() || 'mp3'
    const formatMap = { mp3: 'mp3', flac: 'flac', m4a: 'mp4', ogg: 'ogg', wav: 'wav' }
    const format = formatMap[ext] || 'mp3'
    
    const newSound = new Howl({
      src: [audioUrl],
      html5: true,
      format: [format],
      volume: get().volume,
      preload: true,
      onload: () => {
        console.log('Track loaded:', track.title)
        set({ 
          duration: newSound.duration(),
          isLoading: false 
        })
        // Set initial Media Session metadata
        updateMediaSession(track, false, get().getMediaSessionActions())
        if (autoPlay) {
          newSound.play()
        }
      },
      onplay: () => {
        console.log('Playing:', track.title)
        set({ isPlaying: true })
        get().startProgressTimer()
        // Update Media Session
        updateMediaSession(track, true, get().getMediaSessionActions())
        // Record play history (fire and forget)
        if (track.id) {
          fetch(`${API_URL}/api/music/history/${track.id}`, { method: 'POST' })
            .catch(() => {}) // Ignore errors
        }
      },
      onpause: () => {
        console.log('Paused:', track.title)
        set({ isPlaying: false })
        // Update Media Session
        updateMediaSession(track, false, null)
      },
      onstop: () => {
        set({ isPlaying: false, currentTime: 0 })
        get().stopProgressTimer()
      },
      onend: () => {
        console.log('Track ended:', track.title)
        get().stopProgressTimer()
        get().playNext()
      },
      onloaderror: (id, error) => {
        console.error('Audio load error:', error)
        set({ isLoading: false })
      },
      onplayerror: (id, error) => {
        console.error('Audio play error:', error)
        // Try to unlock audio on mobile
        newSound.once('unlock', () => {
          newSound.play()
        })
      }
    })
    
    set({ sound: newSound })
  },

  play: () => {
    const { sound, currentTrack } = get()
    if (sound) {
      sound.play()
    } else if (currentTrack) {
      get().loadTrack(currentTrack, true)
    }
  },

  pause: () => {
    const { sound } = get()
    if (sound) {
      sound.pause()
    }
    // Stop the progress timer to prevent memory leak
    get().stopProgressTimer()
  },

  toggle: () => {
    const { isPlaying } = get()
    if (isPlaying) {
      get().pause()
    } else {
      get().play()
    }
  },

  seek: (time) => {
    const { sound } = get()
    if (sound) {
      sound.seek(time)
      set({ currentTime: time })
    }
  },

  stopProgressTimer: () => {
    if (progressIntervalId) {
      clearInterval(progressIntervalId)
      progressIntervalId = null
    }
  },

  startProgressTimer: () => {
    // Cancel any existing timer first to prevent duplicates
    get().stopProgressTimer()
    
    const { sound } = get()
    if (!sound) return
    
    // Use setInterval with 250ms (4 updates per second) - much lighter than 60fps requestAnimationFrame
    progressIntervalId = setInterval(() => {
      const { sound, isPlaying, duration, isPreloading } = get()
      if (sound && isPlaying) {
        const currentTime = sound.seek() || 0
        set({ currentTime })
        
        // Gapless playback: preload next track when 15 seconds remain
        const timeRemaining = duration - currentTime
        if (timeRemaining <= 15 && timeRemaining > 0 && !isPreloading) {
          get().preloadNextTrack()
        }
        
        // Update Media Session position state for lock screen/Bluetooth progress
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
          try {
            navigator.mediaSession.setPositionState({
              duration: duration || 0,
              playbackRate: 1,
              position: currentTime
            })
          } catch (e) {
            // Ignore position state errors
          }
        }
      } else {
        // Not playing anymore, stop the timer
        get().stopProgressTimer()
      }
    }, 250) // Update 4 times per second - smooth enough for progress bar
  },

  // Gapless playback: preload the next track in queue
  preloadNextTrack: () => {
    const { queue, queueIndex, nextSound, isPreloading } = get()
    
    // Don't preload if already preloading or no next track
    if (isPreloading || nextSound) return
    if (queueIndex >= queue.length - 1) return
    
    const nextTrackData = queue[queueIndex + 1]
    if (!nextTrackData || !nextTrackData.is_downloaded) return
    
    set({ isPreloading: true })
    console.log('Preloading next track:', nextTrackData.title)
    
    const audioUrl = `${API_URL}/api/music/stream/${nextTrackData.id}`
    const ext = nextTrackData.file_path?.split('.').pop()?.toLowerCase() || 'mp3'
    const formatMap = { mp3: 'mp3', flac: 'flac', m4a: 'mp4', ogg: 'ogg', wav: 'wav' }
    const format = formatMap[ext] || 'mp3'
    
    const preloadedSound = new Howl({
      src: [audioUrl],
      html5: true,
      format: [format],
      volume: get().volume,
      preload: true,
      onload: () => {
        console.log('Next track preloaded:', nextTrackData.title)
        set({ nextSound: preloadedSound, nextTrack: nextTrackData, isPreloading: false })
      },
      onloaderror: (id, error) => {
        console.error('Failed to preload next track:', error)
        set({ isPreloading: false })
      }
    })
  },

  // Clear preloaded track (call when queue changes or track is skipped)
  clearPreloadedTrack: () => {
    const { nextSound } = get()
    if (nextSound) {
      nextSound.unload()
    }
    set({ nextSound: null, nextTrack: null, isPreloading: false })
  },

  // Queue management
  setQueue: (tracks, startIndex = 0, autoPlay = true) => {
    set({ queue: tracks, queueIndex: startIndex })
    if (tracks.length > 0) {
      get().loadTrack(tracks[startIndex], autoPlay)
      // Save to localStorage
      saveQueueToStorage(tracks, startIndex, tracks[startIndex])
    }
  },

  addToQueue: (track) => {
    const { queue, queueIndex, currentTrack } = get()
    const newQueue = [...queue, track]
    set({ queue: newQueue })
    saveQueueToStorage(newQueue, queueIndex, currentTrack)
  },

  addTracksToQueue: (tracks) => {
    const { queue, queueIndex, currentTrack } = get()
    const newQueue = [...queue, ...tracks]
    set({ queue: newQueue })
    saveQueueToStorage(newQueue, queueIndex, currentTrack)
  },

  addToQueueNext: (track) => {
    const { queue, queueIndex, currentTrack } = get()
    const newQueue = [...queue]
    newQueue.splice(queueIndex + 1, 0, track)
    set({ queue: newQueue })
    saveQueueToStorage(newQueue, queueIndex, currentTrack)
  },

  addTracksToQueueNext: (tracks) => {
    const { queue, queueIndex, currentTrack } = get()
    const newQueue = [...queue]
    newQueue.splice(queueIndex + 1, 0, ...tracks)
    set({ queue: newQueue })
    saveQueueToStorage(newQueue, queueIndex, currentTrack)
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex, currentTrack } = get()
    const newQueue = queue.filter((_, i) => i !== index)
    
    let newIndex = queueIndex
    if (index < queueIndex) {
      newIndex = queueIndex - 1
    } else if (index === queueIndex && index >= newQueue.length) {
      newIndex = newQueue.length - 1
    }
    
    set({ queue: newQueue, queueIndex: Math.max(0, newIndex) })
    saveQueueToStorage(newQueue, Math.max(0, newIndex), currentTrack)
  },

  // Restore queue from localStorage (call on app init)
  restoreQueue: () => {
    const { queue, queueIndex, currentTrack, volume } = loadQueueFromStorage()
    if (queue && queue.length > 0) {
      set({ queue, queueIndex, currentTrack, volume })
      console.log('Queue restored:', queue.length, 'tracks')
      return true
    }
    return false
  },

  // Refresh queue from backend (call after download completes)
  refreshQueue: async () => {
    try {
      const response = await api.get('/queue')
      const backendQueue = response.data
      
      if (backendQueue && backendQueue.length > 0) {
        // Convert backend queue items to track format
        const tracks = backendQueue.map(item => ({
          id: item.track.id,
          title: item.track.title,
          artist_name: item.track.artist_name,
          album_title: item.track.album_title,
          album_id: item.track.album_id,
          duration: item.track.duration,
          file_path: item.track.file_path,
          is_downloaded: item.track.is_downloaded,
          cover_art_url: item.track.cover_art_url
        }))
        
        const { currentTrack, isPlaying } = get()
        
        // If nothing is playing, start playing the first track
        if (!currentTrack || !isPlaying) {
          console.log('Starting playback from refreshed queue:', tracks.length, 'tracks')
          get().setQueue(tracks, 0, true)
        } else {
          // Just update the queue without interrupting playback
          set({ queue: tracks })
          saveQueueToStorage(tracks, get().queueIndex, currentTrack)
        }
        
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to refresh queue:', error)
      return false
    }
  },

  clearQueue: () => {
    const { sound } = get()
    // Stop progress timer first
    get().stopProgressTimer()
    if (sound) {
      sound.stop()
      sound.unload()
    }
    // Clear preloaded track
    get().clearPreloadedTrack()
    // Clear Media Session for iOS
    clearMediaSession()
    // Clear localStorage
    saveQueueToStorage([], 0, null)
    set({ queue: [], queueIndex: 0, currentTrack: null, sound: null, isPlaying: false })
  },

  playNext: async () => {
    const { queue, queueIndex, nextSound, nextTrack, sound } = get()
    
    if (queueIndex < queue.length - 1) {
      const nextIndex = queueIndex + 1
      
      // Stop current sound
      get().stopProgressTimer()
      if (sound) {
        sound.stop()
        sound.unload()
      }
      
      // Gapless playback: use preloaded track if available
      if (nextSound && nextTrack && nextTrack.id === queue[nextIndex].id) {
        console.log('Gapless transition to:', nextTrack.title)
        
        // Set up event handlers for the preloaded sound
        nextSound.on('play', () => {
          set({ isPlaying: true })
          get().startProgressTimer()
          updateMediaSession(nextTrack, true, get().getMediaSessionActions())
        })
        nextSound.on('pause', () => {
          set({ isPlaying: false })
          updateMediaSession(nextTrack, false, null)
        })
        nextSound.on('stop', () => {
          set({ isPlaying: false, currentTime: 0 })
          get().stopProgressTimer()
        })
        nextSound.on('end', () => {
          console.log('Track ended:', nextTrack.title)
          get().stopProgressTimer()
          get().playNext()
        })
        
        // Switch to preloaded sound
        set({ 
          queueIndex: nextIndex, 
          currentTrack: nextTrack, 
          sound: nextSound,
          duration: nextSound.duration(),
          currentTime: 0,
          nextSound: null, 
          nextTrack: null,
          isPreloading: false
        })
        
        // Play immediately for gapless effect
        nextSound.play()
        updateMediaSession(nextTrack, false, get().getMediaSessionActions())
      } else {
        // Fallback: load track normally (clears any stale preload)
        get().clearPreloadedTrack()
        set({ queueIndex: nextIndex })
        get().loadTrack(queue[nextIndex], true)
      }
      
      // Update backend queue
      try {
        await api.post('/queue/next')
      } catch (error) {
        console.error('Failed to update queue:', error)
      }
    } else {
      // End of queue
      get().clearPreloadedTrack()
      set({ isPlaying: false })
    }
  },

  playPrevious: async () => {
    const { queue, queueIndex, currentTime } = get()
    
    // If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      get().seek(0)
      return
    }
    
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1
      // Clear preloaded track since queue position changed
      get().clearPreloadedTrack()
      set({ queueIndex: prevIndex })
      get().loadTrack(queue[prevIndex], true)
      
      // Update backend queue
      try {
        await api.post('/queue/previous')
      } catch (error) {
        console.error('Failed to update queue:', error)
      }
    } else {
      // Beginning of queue, restart current track
      get().seek(0)
    }
  },

  playTrackFromQueue: (index) => {
    const { queue } = get()
    if (index >= 0 && index < queue.length) {
      // Clear preloaded track since queue position changed
      get().clearPreloadedTrack()
      set({ queueIndex: index })
      get().loadTrack(queue[index], true)
    }
  },

  // Utility
  formatTime: (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  },

  // Media Session actions for hardware buttons (Bluetooth, lock screen, etc.)
  getMediaSessionActions: () => ({
    play: () => get().play(),
    pause: () => get().pause(),
    previous: () => get().playPrevious(),
    next: () => get().playNext(),
    seekTo: (details) => {
      if (details.seekTime !== undefined) {
        get().seek(details.seekTime)
      }
    },
    seekBackward: (details) => {
      const skipTime = details.seekOffset || 10
      const { currentTime } = get()
      get().seek(Math.max(0, currentTime - skipTime))
    },
    seekForward: (details) => {
      const skipTime = details.seekOffset || 10
      const { currentTime, duration } = get()
      get().seek(Math.min(duration, currentTime + skipTime))
    }
  }),

  // Initialize Media Session handlers (call once on app start)
  initMediaSession: () => {
    if (!('mediaSession' in navigator)) return
    
    const actions = get().getMediaSessionActions()
    try {
      navigator.mediaSession.setActionHandler('play', actions.play)
      navigator.mediaSession.setActionHandler('pause', actions.pause)
      navigator.mediaSession.setActionHandler('previoustrack', actions.previous)
      navigator.mediaSession.setActionHandler('nexttrack', actions.next)
      navigator.mediaSession.setActionHandler('seekto', actions.seekTo)
      navigator.mediaSession.setActionHandler('seekbackward', actions.seekBackward)
      navigator.mediaSession.setActionHandler('seekforward', actions.seekForward)
      console.log('Media Session handlers registered')
    } catch (e) {
      console.log('Media Session init error:', e)
    }
  }
}))
