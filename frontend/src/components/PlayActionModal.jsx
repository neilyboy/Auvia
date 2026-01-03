import { X, Play, ListPlus, ListStart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function PlayActionModal({ 
  isOpen, 
  onClose, 
  onPlayNow, 
  onAddToQueue, 
  onPlayNext,
  title = "What would you like to do?",
  itemName = "this"
}) {
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
          className="w-full sm:max-w-sm bg-auvia-card rounded-t-2xl sm:rounded-2xl p-6 pb-8 sm:pb-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 -m-2 text-auvia-muted hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <button
              onClick={() => {
                onPlayNow()
                onClose()
              }}
              className="w-full flex items-center gap-4 p-4 bg-auvia-accent/20 hover:bg-auvia-accent/30 rounded-xl transition-colors"
            >
              <div className="p-2 bg-auvia-accent rounded-full">
                <Play size={20} className="text-white ml-0.5" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Play Now</p>
                <p className="text-auvia-muted text-sm">Replace queue and start playing</p>
              </div>
            </button>

            <button
              onClick={() => {
                onPlayNext()
                onClose()
              }}
              className="w-full flex items-center gap-4 p-4 bg-auvia-border/30 hover:bg-auvia-border/50 rounded-xl transition-colors"
            >
              <div className="p-2 bg-auvia-border rounded-full">
                <ListStart size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Play Next</p>
                <p className="text-auvia-muted text-sm">Add after current song</p>
              </div>
            </button>

            <button
              onClick={() => {
                onAddToQueue()
                onClose()
              }}
              className="w-full flex items-center gap-4 p-4 bg-auvia-border/30 hover:bg-auvia-border/50 rounded-xl transition-colors"
            >
              <div className="p-2 bg-auvia-border rounded-full">
                <ListPlus size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Add to Queue</p>
                <p className="text-auvia-muted text-sm">Add to end of queue</p>
              </div>
            </button>
          </div>

          {/* Cancel button for mobile */}
          <button
            onClick={onClose}
            className="w-full mt-4 p-3 text-auvia-muted hover:text-white text-center sm:hidden"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
