import { useEffect, useRef, useState } from 'react'
import { useDownloadStore } from '../stores/downloadStore'
import { usePlayerStore } from '../stores/playerStore'
import { Loader2, Download, CheckCircle } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function DownloadBanner() {
  const { activeDownloads, removeDownload } = useDownloadStore()
  const { refreshQueue } = usePlayerStore()
  const pollingRef = useRef(null)
  const completedRef = useRef(new Set())
  const [completedDownloads, setCompletedDownloads] = useState(new Set())
  
  // Poll for download completion
  useEffect(() => {
    if (activeDownloads.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }
    
    const checkDownloads = async () => {
      try {
        const response = await api.get('/queue/downloads')
        const tasks = response.data
        
        // Check each active download against backend tasks
        for (const download of activeDownloads) {
          // Extract qobuz ID from download ID (format: download-{qobuzId})
          const qobuzId = download.id.replace('download-', '')
          
          // Find matching task by URL containing the qobuz ID
          const task = tasks.find(t => t.qobuz_url?.includes(qobuzId))
          
          if (task) {
            if (task.status === 'completed' && !completedRef.current.has(download.id)) {
              completedRef.current.add(download.id)
              
              // Mark as completed for visual feedback
              setCompletedDownloads(prev => new Set([...prev, download.id]))
              
              // Refresh queue from backend - this will load the newly queued tracks
              await refreshQueue()
              
              // Small delay before removing to show success (banner shows completion)
              setTimeout(() => {
                removeDownload(download.id)
                completedRef.current.delete(download.id)
                setCompletedDownloads(prev => {
                  const next = new Set(prev)
                  next.delete(download.id)
                  return next
                })
              }, 2500)
            } else if (task.status === 'failed' && !completedRef.current.has(download.id)) {
              completedRef.current.add(download.id)
              toast.error(`Download failed: ${task.error_message || 'Unknown error'}`)
              setTimeout(() => {
                removeDownload(download.id)
                completedRef.current.delete(download.id)
              }, 2000)
            }
          }
        }
      } catch (error) {
        console.error('Error checking download status:', error)
      }
    }
    
    // Check immediately and then every 3 seconds
    checkDownloads()
    pollingRef.current = setInterval(checkDownloads, 3000)
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [activeDownloads, removeDownload, refreshQueue])
  
  if (activeDownloads.length === 0) return null
  
  const currentDownload = activeDownloads[0]
  const queueCount = activeDownloads.length - 1
  const isCompleted = completedDownloads.has(currentDownload.id)
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-fade-in">
      <div className={`backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-3 text-white text-sm transition-all duration-300 ${
        isCompleted 
          ? 'bg-gradient-to-r from-green-500/90 to-emerald-600/90' 
          : 'bg-gradient-to-r from-auvia-accent/90 to-purple-600/90'
      }`}>
        {isCompleted ? (
          <CheckCircle size={18} className="text-white" />
        ) : (
          <div className="flex items-center gap-2 animate-pulse">
            <Download size={16} className="animate-bounce" />
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
        <span className="font-medium">
          {isCompleted ? 'Downloaded' : 'Downloading'}: {currentDownload.title || currentDownload.albumTitle || 'Album'}
        </span>
        {queueCount > 0 && !isCompleted && (
          <span className="text-white/70">
            (+{queueCount} more)
          </span>
        )}
      </div>
    </div>
  )
}
