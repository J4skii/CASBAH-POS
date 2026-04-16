import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10_000
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mojatill_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mojatill_token')
      localStorage.removeItem('mojatill_user')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export default api
