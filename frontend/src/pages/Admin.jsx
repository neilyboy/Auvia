import { useState, useEffect } from 'react'
import { 
  Settings, Lock, HardDrive, Music, 
  ChevronRight, Check, Save, Eye, EyeOff,
  Plus, Trash2, RefreshCw
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function Admin() {
  const { user, isAdmin, pinLogin, logout } = useAuthStore()
  const [showPinModal, setShowPinModal] = useState(!isAdmin)
  const [pin, setPin] = useState('')
  const [activeSection, setActiveSection] = useState('qobuz')

  const handlePinSubmit = async (e) => {
    e.preventDefault()
    const result = await pinLogin(pin)
    if (result.success) {
      setShowPinModal(false)
      toast.success('Admin access granted')
    } else {
      toast.error(result.error)
    }
    setPin('')
  }

  if (showPinModal || !isAdmin) {
    return (
      <div className="p-4 pt-8">
        <h1 className="text-2xl font-bold text-white mb-6">Admin Panel</h1>
        
        <div className="max-w-sm mx-auto">
          <div className="bg-auvia-card rounded-2xl p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-auvia-accent/20 rounded-full flex items-center justify-center mb-4">
                <Lock size={32} className="text-auvia-accent" />
              </div>
              <h2 className="text-xl font-semibold text-white">Enter Admin PIN</h2>
              <p className="text-auvia-muted text-sm mt-1">
                Access restricted to administrators
              </p>
            </div>
            
            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white text-center text-2xl tracking-widest placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent mb-4"
                autoFocus
              />
              <button
                type="submit"
                disabled={pin.length < 4}
                className="w-full py-3 bg-auvia-accent rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-feedback"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pt-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <button
          onClick={logout}
          className="text-auvia-muted hover:text-white text-sm touch-feedback"
        >
          Logout
        </button>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'qobuz', label: 'Qobuz', icon: Music },
          { id: 'storage', label: 'Storage', icon: HardDrive },
          { id: 'account', label: 'Account', icon: Lock },
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeSection === tab.id
                  ? 'bg-auvia-accent text-white'
                  : 'bg-auvia-card text-auvia-muted hover:text-white'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeSection === 'qobuz' && <QobuzSettings />}
      {activeSection === 'storage' && <StorageSettings />}
      {activeSection === 'account' && <AccountSettings />}
    </div>
  )
}

function QobuzSettings() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [formData, setFormData] = useState({
    quality: 1,
    download_booklets: true,
    use_auth_token: true,
    email_or_userid: '',
    password_or_token: '',
    app_id: '',
    secrets: ''
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await api.get('/admin/qobuz-config')
      setConfig(response.data)
      setFormData({
        quality: response.data.quality || 1,
        download_booklets: response.data.download_booklets ?? true,
        use_auth_token: response.data.use_auth_token ?? true,
        email_or_userid: response.data.email_or_userid || '',
        password_or_token: '',
        app_id: response.data.app_id || '',
        secrets: ''
      })
    } catch (error) {
      toast.error('Failed to load Qobuz config')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const payload = {
        ...formData,
        secrets: formData.secrets ? formData.secrets.split(',').map(s => s.trim()).filter(Boolean) : null
      }
      
      // Only include password if it was changed
      if (!formData.password_or_token) {
        delete payload.password_or_token
      }
      if (!formData.secrets) {
        delete payload.secrets
      }
      
      await api.post('/admin/qobuz-config', payload)
      toast.success('Qobuz settings saved')
      fetchConfig()
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const qualityOptions = [
    { value: 1, label: '320kbps MP3' },
    { value: 2, label: 'CD Quality (16-bit/44.1kHz)' },
    { value: 3, label: 'Hi-Res (24-bit/96kHz)' },
    { value: 4, label: 'Hi-Res+ (24-bit/192kHz)' },
  ]

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-auvia-card rounded-xl" />)}
    </div>
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Quality */}
      <div className="bg-auvia-card rounded-xl p-4">
        <label className="block text-sm font-medium text-white mb-2">Audio Quality</label>
        <select
          value={formData.quality}
          onChange={(e) => setFormData({ ...formData, quality: parseInt(e.target.value) })}
          className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-auvia-accent"
        >
          {qualityOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Auth Type */}
      <div className="bg-auvia-card rounded-xl p-4">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Use Auth Token</span>
          <input
            type="checkbox"
            checked={formData.use_auth_token}
            onChange={(e) => setFormData({ ...formData, use_auth_token: e.target.checked })}
            className="w-5 h-5 rounded bg-auvia-dark border-auvia-border text-auvia-accent focus:ring-auvia-accent"
          />
        </label>
        <p className="text-auvia-muted text-xs mt-1">
          {formData.use_auth_token ? 'Using user ID and auth token' : 'Using email and password hash'}
        </p>
      </div>

      {/* User ID / Email */}
      <div className="bg-auvia-card rounded-xl p-4">
        <label className="block text-sm font-medium text-white mb-2">
          {formData.use_auth_token ? 'User ID' : 'Email'}
        </label>
        <input
          type="text"
          value={formData.email_or_userid}
          onChange={(e) => setFormData({ ...formData, email_or_userid: e.target.value })}
          placeholder={formData.use_auth_token ? 'Enter your Qobuz user ID' : 'Enter your email'}
          className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
        />
      </div>

      {/* Token / Password */}
      <div className="bg-auvia-card rounded-xl p-4">
        <label className="block text-sm font-medium text-white mb-2">
          {formData.use_auth_token ? 'Auth Token' : 'Password (MD5 hash)'}
        </label>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={formData.password_or_token}
            onChange={(e) => setFormData({ ...formData, password_or_token: e.target.value })}
            placeholder={config?.has_password_or_token ? '••••••••••••' : 'Enter token/password'}
            className="w-full px-4 py-3 pr-12 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-auvia-muted"
          >
            {showToken ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {config?.has_password_or_token && (
          <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
            <Check size={12} /> Token is set
          </p>
        )}
      </div>

      {/* App ID */}
      <div className="bg-auvia-card rounded-xl p-4">
        <label className="block text-sm font-medium text-white mb-2">App ID</label>
        <input
          type="text"
          value={formData.app_id}
          onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
          placeholder="950096963"
          className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
        />
      </div>

      {/* Secrets */}
      <div className="bg-auvia-card rounded-xl p-4">
        <label className="block text-sm font-medium text-white mb-2">Secrets (comma separated)</label>
        <input
          type="text"
          value={formData.secrets}
          onChange={(e) => setFormData({ ...formData, secrets: e.target.value })}
          placeholder={config?.has_secrets ? 'Secrets are set' : 'secret1, secret2'}
          className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
        />
      </div>

      {/* Download Booklets */}
      <div className="bg-auvia-card rounded-xl p-4">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Download Booklets</span>
          <input
            type="checkbox"
            checked={formData.download_booklets}
            onChange={(e) => setFormData({ ...formData, download_booklets: e.target.checked })}
            className="w-5 h-5 rounded bg-auvia-dark border-auvia-border text-auvia-accent focus:ring-auvia-accent"
          />
        </label>
      </div>

      {/* Save Button */}
      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-auvia-accent rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 touch-feedback"
      >
        {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
        Save Settings
      </button>
    </form>
  )
}

function StorageSettings() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newLocation, setNewLocation] = useState({ name: '', path: '', is_primary: false })

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await api.get('/admin/storage')
      setLocations(response.data)
    } catch (error) {
      toast.error('Failed to load storage locations')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/storage', { ...newLocation, is_active: true })
      toast.success('Storage location added')
      setShowAdd(false)
      setNewLocation({ name: '', path: '', is_primary: false })
      fetchLocations()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add location')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this storage location?')) return
    try {
      await api.delete(`/admin/storage/${id}`)
      toast.success('Storage location deleted')
      fetchLocations()
    } catch (error) {
      toast.error('Failed to delete location')
    }
  }

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-auvia-card rounded-xl" />)}
    </div>
  }

  return (
    <div className="space-y-4">
      {locations.map((loc) => (
        <div key={loc.id} className="bg-auvia-card rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <HardDrive size={18} className="text-auvia-accent" />
                <span className="font-medium text-white">{loc.name}</span>
                {loc.is_primary && (
                  <span className="px-2 py-0.5 bg-auvia-accent/20 text-auvia-accent text-xs rounded-full">
                    Primary
                  </span>
                )}
              </div>
              <p className="text-auvia-muted text-sm mt-1 font-mono">{loc.path}</p>
              {loc.free_space && (
                <p className="text-auvia-muted text-xs mt-1">
                  {loc.free_space} free of {loc.total_space}
                </p>
              )}
            </div>
            <button
              onClick={() => handleDelete(loc.id)}
              className="p-2 text-auvia-muted hover:text-red-400 touch-feedback"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}

      {showAdd ? (
        <form onSubmit={handleAdd} className="bg-auvia-card rounded-xl p-4 space-y-3">
          <input
            type="text"
            value={newLocation.name}
            onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
            placeholder="Location name"
            className="w-full px-4 py-2 bg-auvia-dark rounded-lg text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
            required
          />
          <input
            type="text"
            value={newLocation.path}
            onChange={(e) => setNewLocation({ ...newLocation, path: e.target.value })}
            placeholder="/path/to/storage"
            className="w-full px-4 py-2 bg-auvia-dark rounded-lg text-white placeholder-auvia-muted font-mono focus:outline-none focus:ring-2 focus:ring-auvia-accent"
            required
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newLocation.is_primary}
              onChange={(e) => setNewLocation({ ...newLocation, is_primary: e.target.checked })}
              className="w-4 h-4 rounded bg-auvia-dark border-auvia-border text-auvia-accent focus:ring-auvia-accent"
            />
            <span className="text-sm text-auvia-muted">Set as primary</span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2 bg-auvia-accent rounded-lg text-white font-medium touch-feedback"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-auvia-dark rounded-lg text-auvia-muted touch-feedback"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border-2 border-dashed border-auvia-border rounded-xl text-auvia-muted hover:text-white hover:border-auvia-accent flex items-center justify-center gap-2 touch-feedback"
        >
          <Plus size={18} />
          Add Storage Location
        </button>
      )}
    </div>
  )
}

function AccountSettings() {
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChangePin = async (e) => {
    e.preventDefault()
    if (newPin !== confirmPin) {
      toast.error('PINs do not match')
      return
    }
    if (newPin.length < 4) {
      toast.error('PIN must be at least 4 digits')
      return
    }
    
    setSaving(true)
    try {
      await api.post('/auth/change-pin', null, { params: { new_pin: newPin } })
      toast.success('PIN changed successfully')
      setNewPin('')
      setConfirmPin('')
    } catch (error) {
      toast.error('Failed to change PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleChangePin} className="bg-auvia-card rounded-xl p-4 space-y-4">
        <h3 className="font-medium text-white">Change Admin PIN</h3>
        
        <div>
          <label className="block text-sm text-auvia-muted mb-1">New PIN</label>
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="Enter new PIN"
            className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
            minLength={4}
            maxLength={10}
          />
        </div>
        
        <div>
          <label className="block text-sm text-auvia-muted mb-1">Confirm PIN</label>
          <input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="Confirm new PIN"
            className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
            minLength={4}
            maxLength={10}
          />
        </div>
        
        <button
          type="submit"
          disabled={saving || !newPin || !confirmPin}
          className="w-full py-3 bg-auvia-accent rounded-xl text-white font-medium disabled:opacity-50 touch-feedback"
        >
          {saving ? 'Saving...' : 'Change PIN'}
        </button>
      </form>
    </div>
  )
}
