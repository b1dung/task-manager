import axios from 'axios'
import { useAuthStore } from '@/stores/useAuthStore'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let queue: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    if (isRefreshing) {
      return new Promise((resolve) => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(apiClient(original))
        })
      })
    }

    isRefreshing = true
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      const { accessToken } = data.data as { accessToken: string }
      useAuthStore.getState().setTokens(accessToken, '')
      queue.forEach((cb) => cb(accessToken))
      queue = []
      original.headers.Authorization = `Bearer ${accessToken}`
      return apiClient(original)
    } catch {
      useAuthStore.getState().logout()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)
