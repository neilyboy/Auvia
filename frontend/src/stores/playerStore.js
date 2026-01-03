import { create } from 'zustand'
import { Howl } from 'howler'
import api, { API_URL } from '../services/api'

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
  },

  loadTrack: async (track, autoPlay = true) => {
    const { sound } = get()
    
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
        if (autoPlay) {
          newSound.play()
        }
      },
      onplay: () => {
        console.log('Playing:', track.title)
        set({ isPlaying: true })
        get().startProgressTimer()
      },
      onpause: () => {
        console.log('Paused:', track.title)
        set({ isPlaying: false })
      },
      onstop: () => {
        set({ isPlaying: false, currentTime: 0 })
      },
      onend: () => {
        console.log('Track ended:', track.title)
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

  startProgressTimer: () => {
    const { sound } = get()
    if (!sound) return
    
    const update = () => {
      const { sound, isPlaying } = get()
      if (sound && isPlaying) {
        set({ currentTime: sound.seek() || 0 })
        requestAnimationFrame(update)
      }
    }
    requestAnimationFrame(update)
  },

  // Queue management
  setQueue: (tracks, startIndex = 0, autoPlay = true) => {
    set({ queue: tracks, queueIndex: startIndex })
    if (tracks.length > 0) {
      get().loadTrack(tracks[startIndex], autoPlay)
    }
  },

  addToQueue: (track) => {
    const { queue } = get()
    set({ queue: [...queue, track] })
  },

  addToQueueNext: (track) => {
    const { queue, queueIndex } = get()
    const newQueue = [...queue]
    newQueue.splice(queueIndex + 1, 0, track)
    set({ queue: newQueue })
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get()
    const newQueue = queue.filter((_, i) => i !== index)
    
    let newIndex = queueIndex
    if (index < queueIndex) {
      newIndex = queueIndex - 1
    } else if (index === queueIndex && index >= newQueue.length) {
      newIndex = newQueue.length - 1
    }
    
    set({ queue: newQueue, queueIndex: Math.max(0, newIndex) })
  },

  clearQueue: () => {
    const { sound } = get()
    if (sound) {
      sound.stop()
      sound.unload()
    }
    set({ queue: [], queueIndex: 0, currentTrack: null, sound: null, isPlaying: false })
  },

  playNext: async () => {
    const { queue, queueIndex } = get()
    
    if (queueIndex < queue.length - 1) {
      const nextIndex = queueIndex + 1
      set({ queueIndex: nextIndex })
      get().loadTrack(queue[nextIndex], true)
      
      // Update backend queue
      try {
        await api.post('/queue/next')
      } catch (error) {
        console.error('Failed to update queue:', error)
      }
    } else {
      // End of queue
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
  }
}))
