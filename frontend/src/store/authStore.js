import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user:  null,
  token: null,

  loadFromStorage: () => {
    try {
      const token = localStorage.getItem('mojatill_token')
      const user  = JSON.parse(localStorage.getItem('mojatill_user') ?? 'null')
      if (token && user) set({ user, token })
    } catch {
      // Ignore corrupted storage
    }
  },

  login: (user, token) => {
    localStorage.setItem('mojatill_token', token)
    localStorage.setItem('mojatill_user',  JSON.stringify(user))
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('mojatill_token')
    localStorage.removeItem('mojatill_user')
    set({ user: null, token: null })
  }
}))
