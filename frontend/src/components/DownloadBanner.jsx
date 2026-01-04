import { useDownloadStore } from '../stores/downloadStore'
import { Loader2, Download } from 'lucide-react'

export default function DownloadBanner() {
  const { activeDownloads } = useDownloadStore()
  
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
