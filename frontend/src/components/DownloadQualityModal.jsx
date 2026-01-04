import { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const QUALITY_OPTIONS = [
  { value: 1, label: 'MP3 320kbps', description: 'Smallest file size, good quality' },
  { value: 2, label: 'CD Quality (16-bit/44.1kHz)', description: 'Lossless, standard CD quality' },
  { value: 3, label: 'Hi-Res (24-bit/96kHz)', description: 'High resolution audio' },
  { value: 4, label: 'Hi-Res+ (24-bit/192kHz)', description: 'Maximum quality available' },
]

export default function DownloadQualityModal({ 
  isOpen, 
  onClose, 
  onDownload,
  albumTitle,
  isDownloading = false
}) {
  const [selectedQuality, setSelectedQuality] = useState(1)

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-md bg-auvia-card rounded-t-2xl sm:rounded-2xl p-6 pb-8 sm:pb-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Download Album</h3>
              <p className="text-auvia-muted text-sm truncate max-w-[280px]">{albumTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 -m-2 text-auvia-muted hover:text-white"
              disabled={isDownloading}
            >
              <X size={20} />
            </button>
          </div>

          {/* Quality Options */}
          <div className="space-y-2 mb-6">
            <p className="text-sm text-auvia-muted mb-3">Select quality:</p>
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedQuality(option.value)}
                disabled={isDownloading}
                className={`w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left ${
                  selectedQuality === option.value
                    ? 'bg-auvia-accent/20 border border-auvia-accent/50'
                    : 'bg-auvia-border/30 hover:bg-auvia-border/50 border border-transparent'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  selectedQuality === option.value
                    ? 'border-auvia-accent bg-auvia-accent'
                    : 'border-auvia-muted'
                }`}>
                  {selectedQuality === option.value && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{option.label}</p>
                  <p className="text-auvia-muted text-xs">{option.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Download Button */}
          <button
            onClick={() => onDownload(selectedQuality)}
            disabled={isDownloading}
            className="w-full flex items-center justify-center gap-2 p-4 bg-auvia-accent hover:bg-auvia-accent/80 disabled:bg-auvia-accent/50 rounded-xl text-white font-medium transition-colors"
          >
            {isDownloading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Preparing Download...
              </>
            ) : (
              <>
                <Download size={20} />
                Download to Device
              </>
            )}
          </button>

          <p className="text-center text-auvia-muted text-xs mt-3">
            File will be saved to your device as a ZIP
          </p>

          {/* Cancel button for mobile */}
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="w-full mt-4 p-3 text-auvia-muted hover:text-white text-center sm:hidden"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
