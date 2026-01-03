import axios from 'axios'

// Dynamically determine API URL - allows external access
const getApiUrl = () => {
  // If explicitly set, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // Otherwise, use the same host as the frontend but on port 8001
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:8001`
}

export const API_URL = getApiUrl()

const api = axios.create({
  baseURL: API_URL + '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auvia-auth')
    if (token) {
      try {
        const parsed = JSON.parse(token)
        if (parsed.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth on unauthorized
      localStorage.removeItem('auvia-auth')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

export default api
