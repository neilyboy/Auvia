import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { usePlayerStore } from './stores/playerStore'
import Layout from './components/Layout'
import Home from './pages/Home'
import Search from './pages/Search'
import Library from './pages/Library'
import Album from './pages/Album'
import Artist from './pages/Artist'
import Queue from './pages/Queue'
import Admin from './pages/Admin'
import Setup from './pages/Setup'

function App() {
  const { checkSetupStatus, setupStatus, loading } = useAuthStore()
  const initMediaSession = usePlayerStore((state) => state.initMediaSession)
  const clearQueue = usePlayerStore((state) => state.clearQueue)

  useEffect(() => {
    checkSetupStatus()
    // Initialize Media Session API for Bluetooth/hardware button support
    initMediaSession()
    
    // Cleanup Media Session on page close/hide for iOS
    const handleBeforeUnload = () => {
      clearQueue()
    }
    
    const handleVisibilityChange = () => {
      // On iOS, clear when page becomes hidden to prevent zombie players
      if (document.visibilityState === 'hidden') {
        // Only clear if no audio is actually playing
        const sound = usePlayerStore.getState().sound
        if (!sound || !sound.playing()) {
          // Clear the media session metadata when page is hidden and not playing
          if ('mediaSession' in navigator) {
            try {
              navigator.mediaSession.playbackState = 'none'
            } catch (e) {
              // Ignore errors
            }
          }
        }
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkSetupStatus, initMediaSession, clearQueue])

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-auvia-dark">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-auvia-accent animate-pulse" />
          <h1 className="text-2xl font-bold text-white">Auvia</h1>
          <p className="text-auvia-muted">Set the Atmosphere</p>
        </div>
      </div>
    )
  }

  // Show setup wizard if not configured
  if (setupStatus?.needs_admin) {
    return <Setup />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/library" element={<Library />} />
        <Route path="/album/:id" element={<Album />} />
        <Route path="/artist/:id" element={<Artist />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
