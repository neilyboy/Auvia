import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music, User, Lock, Key, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function Setup() {
  const navigate = useNavigate()
  const { setup, checkSetupStatus } = useAuthStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Admin account
  const [adminData, setAdminData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    pin: ''
  })
  
  // Qobuz config
  const [qobuzData, setQobuzData] = useState({
    quality: 1,
    use_auth_token: true,
    email_or_userid: '',
    password_or_token: '',
    app_id: '950096963',
    secrets: ''
  })

  const handleAdminSubmit = async (e) => {
    e.preventDefault()
    
    if (adminData.password !== adminData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    
    if (adminData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    
    if (adminData.pin && adminData.pin.length < 4) {
      toast.error('PIN must be at least 4 digits')
      return
    }
    
    setLoading(true)
    const result = await setup(adminData.username, adminData.password, adminData.pin || null)
    setLoading(false)
    
    if (result.success) {
      toast.success('Admin account created!')
      setStep(2)
    } else {
      toast.error(result.error)
    }
  }

  const handleQobuzSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const payload = {
        ...qobuzData,
        secrets: qobuzData.secrets ? qobuzData.secrets.split(',').map(s => s.trim()).filter(Boolean) : null
      }
      
      await api.post('/admin/qobuz-config', payload)
      toast.success('Qobuz configured!')
      setStep(3)
    } catch (error) {
      toast.error('Failed to save Qobuz config')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    await checkSetupStatus()
    navigate('/')
    toast.success('Welcome to Auvia!')
  }

  const qualityOptions = [
    { value: 1, label: '320kbps MP3' },
    { value: 2, label: 'CD Quality (16-bit/44.1kHz)' },
    { value: 3, label: 'Hi-Res (24-bit/96kHz)' },
    { value: 4, label: 'Hi-Res+ (24-bit/192kHz)' },
  ]

  return (
    <div className="min-h-screen bg-auvia-dark flex flex-col items-center py-8 px-4 overflow-y-auto">
      {/* Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-20 h-20 mx-auto bg-auvia-accent rounded-full flex items-center justify-center mb-4">
          <Music size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Auvia</h1>
        <p className="text-auvia-muted">Set the Atmosphere</p>
      </motion.div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step > s ? 'bg-green-500 text-white' :
              step === s ? 'bg-auvia-accent text-white' :
              'bg-auvia-card text-auvia-muted'
            }`}>
              {step > s ? <Check size={16} /> : s}
            </div>
            {s < 3 && (
              <div className={`w-8 h-0.5 mx-1 ${
                step > s ? 'bg-green-500' : 'bg-auvia-card'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {/* Step 1: Create Admin */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="bg-auvia-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-auvia-accent/20 rounded-lg">
                    <User size={24} className="text-auvia-accent" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Create Admin Account</h2>
                    <p className="text-auvia-muted text-sm">Set up your administrator credentials</p>
                  </div>
                </div>

                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">Username</label>
                    <input
                      type="text"
                      value={adminData.username}
                      onChange={(e) => setAdminData({ ...adminData, username: e.target.value })}
                      placeholder="admin"
                      className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                      required
                      minLength={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={adminData.password}
                        onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-12 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-auvia-muted"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={adminData.confirmPassword}
                      onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">
                      Quick Access PIN <span className="text-auvia-muted/70">(optional)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={adminData.pin}
                      onChange={(e) => setAdminData({ ...adminData, pin: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="4-10 digit PIN"
                      className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                    />
                    <p className="text-auvia-muted/70 text-xs mt-1">Used for quick admin access on the device</p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-auvia-accent rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 touch-feedback"
                  >
                    {loading ? 'Creating...' : 'Continue'}
                    <ArrowRight size={18} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* Step 2: Qobuz Config */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="bg-auvia-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-auvia-accent/20 rounded-lg">
                    <Key size={24} className="text-auvia-accent" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Qobuz Configuration</h2>
                    <p className="text-auvia-muted text-sm">Connect your Qobuz account for downloads</p>
                  </div>
                </div>

                <form onSubmit={handleQobuzSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">Audio Quality</label>
                    <select
                      value={qobuzData.quality}
                      onChange={(e) => setQobuzData({ ...qobuzData, quality: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                    >
                      {qualityOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-auvia-dark rounded-xl">
                    <span className="text-sm text-white">Use Auth Token</span>
                    <input
                      type="checkbox"
                      checked={qobuzData.use_auth_token}
                      onChange={(e) => setQobuzData({ ...qobuzData, use_auth_token: e.target.checked })}
                      className="w-5 h-5 rounded bg-auvia-card border-auvia-border text-auvia-accent focus:ring-auvia-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">
                      {qobuzData.use_auth_token ? 'User ID' : 'Email'}
                    </label>
                    <input
                      type="text"
                      value={qobuzData.email_or_userid}
                      onChange={(e) => setQobuzData({ ...qobuzData, email_or_userid: e.target.value })}
                      placeholder={qobuzData.use_auth_token ? 'Your Qobuz user ID' : 'your@email.com'}
                      className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">
                      {qobuzData.use_auth_token ? 'Auth Token' : 'Password (MD5)'}
                    </label>
                    <input
                      type="password"
                      value={qobuzData.password_or_token}
                      onChange={(e) => setQobuzData({ ...qobuzData, password_or_token: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">App ID</label>
                    <input
                      type="text"
                      value={qobuzData.app_id}
                      onChange={(e) => setQobuzData({ ...qobuzData, app_id: e.target.value })}
                      placeholder="950096963"
                      className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-auvia-muted mb-1">Secrets (comma separated)</label>
                    <input
                      type="text"
                      value={qobuzData.secrets}
                      onChange={(e) => setQobuzData({ ...qobuzData, secrets: e.target.value })}
                      placeholder="secret1, secret2"
                      className="w-full px-4 py-3 bg-auvia-dark rounded-xl text-white placeholder-auvia-muted focus:outline-none focus:ring-2 focus:ring-auvia-accent"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-1 py-3 bg-auvia-dark rounded-xl text-auvia-muted font-medium touch-feedback"
                    >
                      Skip for now
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-auvia-accent rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 touch-feedback"
                    >
                      {loading ? 'Saving...' : 'Save'}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="bg-auvia-card rounded-2xl p-8">
                <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                  <Check size={40} className="text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
                <p className="text-auvia-muted mb-6">
                  Auvia is ready to set the atmosphere. Start searching for music and building your library.
                </p>
                <button
                  onClick={handleComplete}
                  className="w-full py-3 bg-auvia-accent rounded-xl text-white font-medium touch-feedback"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
