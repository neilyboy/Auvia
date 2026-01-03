import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setupStatus: null,
      loading: true,
      isAdmin: false,

      checkSetupStatus: async () => {
        try {
          const response = await api.get('/auth/setup-status')
          set({ setupStatus: response.data, loading: false })
          return response.data
        } catch (error) {
          console.error('Setup status check failed:', error)
          set({ loading: false })
          return null
        }
      },

      setup: async (username, password, pin) => {
        try {
          const response = await api.post('/auth/setup', {
            username,
            password,
            pin,
            is_admin: true
          })
          set({
            user: response.data.user,
            token: response.data.access_token,
            isAdmin: response.data.user.is_admin
          })
          api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`
          return { success: true }
        } catch (error) {
          return { success: false, error: error.response?.data?.detail || 'Setup failed' }
        }
      },

      login: async (username, password) => {
        try {
          const response = await api.post('/auth/login', { username, password })
          set({
            user: response.data.user,
            token: response.data.access_token,
            isAdmin: response.data.user.is_admin
          })
          api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`
          return { success: true }
        } catch (error) {
          return { success: false, error: error.response?.data?.detail || 'Login failed' }
        }
      },

      pinLogin: async (pin) => {
        try {
          const response = await api.post('/auth/pin-login', { pin })
          set({
            user: response.data.user,
            token: response.data.access_token,
            isAdmin: response.data.user.is_admin
          })
          api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`
          return { success: true }
        } catch (error) {
          return { success: false, error: error.response?.data?.detail || 'Invalid PIN' }
        }
      },

      logout: () => {
        set({ user: null, token: null, isAdmin: false })
        delete api.defaults.headers.common['Authorization']
      },

      restoreSession: () => {
        const token = get().token
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        }
      }
    }),
    {
      name: 'auvia-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAdmin: state.isAdmin })
    }
  )
)
