import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, Library, ListMusic, Settings } from 'lucide-react'
import Player from './Player'
import { usePlayerStore } from '../stores/playerStore'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/library', icon: Library, label: 'Library' },
  { path: '/queue', icon: ListMusic, label: 'Queue' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const { currentTrack } = usePlayerStore()
  
  return (
    <div className="h-full flex flex-col bg-auvia-dark">
      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto scroll-smooth ${currentTrack ? 'pb-32 md:pb-24' : 'pb-20'}`}>
        {children}
      </main>
      
      {/* Player (shows when track is loaded) */}
      {currentTrack && <Player />}
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-auvia-darker/95 backdrop-blur-lg border-t border-auvia-border safe-area-bottom z-40">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <NavLink
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center w-16 h-full touch-feedback ${
                  isActive ? 'text-auvia-accent' : 'text-auvia-muted'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] mt-1 font-medium">{label}</span>
              </NavLink>
            )
          })}
          <NavLink
            to="/admin"
            className={`flex flex-col items-center justify-center w-16 h-full touch-feedback ${
              location.pathname === '/admin' ? 'text-auvia-accent' : 'text-auvia-muted'
            }`}
          >
            <Settings size={22} strokeWidth={location.pathname === '/admin' ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-medium">Settings</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
