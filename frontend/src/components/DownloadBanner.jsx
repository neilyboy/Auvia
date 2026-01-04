import { useEffect, useRef } from 'react'
import { useDownloadStore } from '../stores/downloadStore'
import { Loader2, Download, CheckCircle } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function DownloadBanner() {
  const { activeDownloads, removeDownload } = useDownloadStore()
  const pollingRef = useRef(null)
  const completedRef = useRef(new Set())
  
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
              toast.success(`Downloaded: ${download.title || download.albumTitle || 'Album'}`)
              // Small delay before removing to show success
              setTimeout(() => {
                removeDownload(download.id)
                completedRef.current.delete(download.id)
              }, 1500)
            } else if (task.status === 'failed' && !completedRef.current.has(download.id)) {
              completedRef.current.add(download.id)
              toast.error(`Download failed: ${task.error_message || 'Unknown error'}`)
              setTimeout(() => {
                removeDownload(download.id)
                completedRef.current.delete(download.id)
              }, 1500)
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
  }, [activeDownloads, removeDownload])
  
  if (activeDownloads.length === 0) return null
  
  const currentDownload = activeDownloads[0]
  const queueCount = activeDownloads.length - 1
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-fade-in">
      <div className="bg-gradient-to-r from-auvia-accent/90 to-purple-600/90 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-3 text-white text-sm">
        <div className="flex items-center gap-2 animate-pulse">
          <Download size={16} className="animate-bounce" />
          <Loader2 size={16} className="animate-spin" />
        </div>
        <span className="font-medium">
          Downloading: {currentDownload.title || currentDownload.albumTitle || 'Album'}
        </span>
        {queueCount > 0 && (
          <span className="text-white/70">
            (+{queueCount} more)
          </span>
        )}
      </div>
    </div>
  )
}
