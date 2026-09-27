import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { isRoomId } from '#/game/protocol'

export const Route = createFileRoute('/api/rooms/$roomId')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
          return new Response('Expected WebSocket', { status: 426 })
        }
        if (!isRoomId(params.roomId)) {
          return new Response('Invalid room', { status: 400 })
        }
        const id = env.MATCH_ROOMS.idFromName(params.roomId)
        return env.MATCH_ROOMS.get(id).fetch(request)
      },
    },
  },
})
