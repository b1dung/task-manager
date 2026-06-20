import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/useAuthStore'

let globalSocket: Socket | null = null

export function useSocket(projectId?: string) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const [socket, setSocket] = useState<Socket | null>(globalSocket)

  useEffect(() => {
    if (!accessToken) return

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(import.meta.env.VITE_WS_URL ?? 'http://localhost:3000', {
        auth: { token: accessToken },
        transports: ['websocket'],
      })
    }
    setSocket(globalSocket)

    if (projectId) {
      globalSocket.emit('project:join', { projectId })
    }

    return () => {
      if (projectId && globalSocket) {
        globalSocket.emit('project:leave', { projectId })
      }
    }
  }, [accessToken, projectId])

  return socket
}
