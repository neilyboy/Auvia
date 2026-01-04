import { create } from 'zustand'

export const useDownloadStore = create((set, get) => ({
  activeDownloads: [],
  
  addDownload: (id, title, albumTitle) => {
    set(state => ({
      activeDownloads: [...state.activeDownloads, { id, title, albumTitle, startedAt: Date.now() }]
    }))
  },
  
  removeDownload: (id) => {
    set(state => ({
      activeDownloads: state.activeDownloads.filter(d => d.id !== id)
    }))
  },
  
  clearDownloads: () => {
    set({ activeDownloads: [] })
  },
  
  isDownloading: () => get().activeDownloads.length > 0
}))
