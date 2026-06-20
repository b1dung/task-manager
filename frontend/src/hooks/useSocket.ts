import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/useAuthStore'

let globalSocket: Socket | null = null

export function useSocket(projectId?: string) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!accessToken) return

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(import.meta.env.VITE_WS_URL ?? 'http://localhost:3000', {
        auth: { token: accessToken },
        transports: ['websocket'],
      })
    }
    socketRef.current = globalSocket

    if (projectId) {
      globalSocket.emit('join:project', projectId)
    }

    return () => {
      if (projectId && globalSocket) {
        globalSocket.emit('leave:project', projectId)
      }
    }
  }, [accessToken, projectId])

  return socketRef.current
}
