import { isRoomId, parseServerMessage } from '#/game/protocol'
import type { ClientMessage, MatchSnapshot, Seat } from '#/game/protocol'
import type { PaddleIntent } from '#/game/rules'

export type MatchView =
  | { kind: 'connecting' }
  | { kind: 'full' }
  | { kind: 'live'; seat: Seat; snapshot: MatchSnapshot }

export type MatchSession = {
  readonly seat: Seat | null
  sendPaddle: (intent: PaddleIntent) => void
  sendRestart: () => void
  onSnapshot: (listener: (view: MatchView) => void) => () => void
  leave: () => void
}

export function createInvite(): { url: string; roomId: string } {
  const roomId = crypto.randomUUID()
  const url = new URL(`/play/${roomId}`, window.location.origin).toString()
  return { url, roomId }
}

export function joinMatch(roomId: string): MatchSession {
  if (!isRoomId(roomId)) {
    return {
      seat: null,
      sendPaddle() {},
      sendRestart() {},
      onSnapshot(listener) {
        listener({ kind: 'full' })
        return () => {}
      },
      leave() {},
    }
  }

  const token = seatToken(roomId)
  let seat: Seat | null = null
  let socket: WebSocket | null = null
  let latest: MatchSnapshot | null = null
  let stopped = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<(view: MatchView) => void>()

  const emit = (view: MatchView) => {
    for (const listener of listeners) listener(view)
  }

  const send = (message: ClientMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }

  const connect = () => {
    if (stopped) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const next = new WebSocket(
      `${protocol}//${window.location.host}/api/rooms/${roomId}`,
    )
    socket = next
    next.addEventListener('open', () => {
      if (socket !== next) return
      send({ type: 'join', token })
    })
    next.addEventListener('message', (event) => {
      if (socket !== next || typeof event.data !== 'string') return
      const message = parseServerMessage(event.data)
      if (!message) return
      if (message.type === 'welcome') {
        seat = message.seat
        if (latest) emit({ kind: 'live', seat, snapshot: latest })
        return
      }
      if (message.type === 'rejected') {
        stopped = true
        seat = null
        emit({ kind: 'full' })
        next.close()
        return
      }
      latest = message
      if (seat) emit({ kind: 'live', seat, snapshot: message })
    })
    next.addEventListener('close', () => {
      if (stopped || socket !== next) return
      seat = null
      reconnectTimer = setTimeout(connect, 400)
    })
  }

  connect()

  return {
    get seat() {
      return seat
    },
    sendPaddle(intent) {
      send({ type: 'paddle', up: intent.up, down: intent.down })
    },
    sendRestart() {
      send({ type: 'restart' })
    },
    onSnapshot(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    leave() {
      stopped = true
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      socket?.close()
      socket = null
    },
  }
}

function seatToken(roomId: string) {
  const key = `pong-seat:${roomId}`
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const token = crypto.randomUUID()
  sessionStorage.setItem(key, token)
  return token
}
