import { DurableObject } from 'cloudflare:workers'
import { parseClientMessage } from '#/game/protocol'
import type {
  MatchPhase,
  MatchSnapshot,
  Seat,
  ServerMessage,
} from '#/game/protocol'
import { createGame, idleIntent, step } from '#/game/rules'
import type { GameState, PaddleIntent } from '#/game/rules'

const GRACE_MS = 15_000
const TICK_HZ = 30
const TICK_MS = 1000 / TICK_HZ
const TICK_DT = 1 / TICK_HZ

type SeatRecord = {
  token: string
  socket: WebSocket | null
  reservedUntil: number
  intent: PaddleIntent
}

export class MatchRoom extends DurableObject<Env> {
  private left: SeatRecord | null = null
  private right: SeatRecord | null = null
  private game: GameState = createGame()
  private phase: MatchPhase = 'waiting'
  private sawOpponent = false
  private timer: ReturnType<typeof setInterval> | null = null

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    server.accept()
    server.addEventListener('message', (event) => {
      this.onMessage(server, event.data)
    })
    server.addEventListener('close', () => {
      this.onClose(server)
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private onMessage(socket: WebSocket, data: unknown) {
    const message = parseClientMessage(data)
    if (!message) return
    if (message.type === 'join') {
      this.claim(socket, message.token)
      return
    }
    if (message.type === 'paddle') {
      const seat = this.seatForSocket(socket)
      if (!seat) return
      seat.intent = {
        up: message.up,
        down: message.down,
        targetY: message.targetY,
      }
      return
    }
    if (this.game.status !== 'finished') return
    if (!this.seatForSocket(socket)) return
    this.game = createGame()
    if (this.left) this.left.intent = { ...idleIntent }
    if (this.right) this.right.intent = { ...idleIntent }
    this.sync()
  }

  private claim(socket: WebSocket, token: string) {
    const now = Date.now()
    const held = this.seatForToken(token)
    if (held) {
      this.attach(held.seat, held.side, socket)
      this.sync()
      return
    }
    if (this.seatAvailable(this.left, now)) {
      this.left = freshSeat(token, socket)
      this.welcome(socket, 'left')
      this.sync()
      return
    }
    if (this.seatAvailable(this.right, now)) {
      this.right = freshSeat(token, socket)
      this.welcome(socket, 'right')
      this.sync()
      return
    }
    this.send(socket, { type: 'rejected', reason: 'full' })
    socket.close(1008, 'full')
  }

  private attach(seat: SeatRecord, side: Seat, socket: WebSocket) {
    const previous = seat.socket
    seat.socket = socket
    seat.reservedUntil = 0
    if (
      previous &&
      previous !== socket &&
      previous.readyState === WebSocket.OPEN
    ) {
      previous.close(4000, 'replaced')
    }
    this.welcome(socket, side)
  }

  private onClose(socket: WebSocket) {
    const seat = this.seatForSocket(socket)
    if (!seat) return
    seat.socket = null
    seat.intent = { ...idleIntent }
    seat.reservedUntil = Date.now() + GRACE_MS
    this.sync()
  }

  private sync() {
    const leftOpen = isOpen(this.left)
    const rightOpen = isOpen(this.right)
    if (leftOpen && rightOpen) this.sawOpponent = true

    if (this.game.status === 'finished') {
      this.phase = 'finished'
      this.stop()
    } else if (leftOpen && rightOpen) {
      this.phase = 'playing'
      this.start()
    } else if (this.sawOpponent && (leftOpen || rightOpen)) {
      this.phase = 'opponent-left'
      this.stop()
    } else {
      this.phase = 'waiting'
      this.stop()
    }
    this.broadcast()
  }

  private start() {
    if (this.timer !== null) return
    this.timer = setInterval(() => {
      this.tick()
    }, TICK_MS)
  }

  private stop() {
    if (this.timer === null) return
    clearInterval(this.timer)
    this.timer = null
  }

  private tick() {
    if (this.phase !== 'playing') return
    this.game = step(
      this.game,
      {
        left: this.left?.intent ?? idleIntent,
        right: this.right?.intent ?? idleIntent,
      },
      TICK_DT,
    )
    if (this.game.status === 'finished') {
      this.phase = 'finished'
      this.stop()
    }
    this.broadcast()
  }

  private welcome(socket: WebSocket, seat: Seat) {
    this.send(socket, { type: 'welcome', seat })
    this.send(socket, this.snapshot())
  }

  private broadcast() {
    const message = this.snapshot()
    this.send(this.left?.socket, message)
    this.send(this.right?.socket, message)
  }

  private snapshot(): MatchSnapshot {
    return {
      type: 'snapshot',
      phase: this.phase,
      leftY: this.game.left.y,
      rightY: this.game.right.y,
      ballX: this.game.ball.x,
      ballY: this.game.ball.y,
      leftScore: this.game.leftScore,
      rightScore: this.game.rightScore,
    }
  }

  private send(socket: WebSocket | null | undefined, message: ServerMessage) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(message))
  }

  private seatForSocket(socket: WebSocket): SeatRecord | null {
    if (this.left?.socket === socket) return this.left
    if (this.right?.socket === socket) return this.right
    return null
  }

  private seatForToken(token: string): { seat: SeatRecord; side: Seat } | null {
    if (this.left?.token === token) return { seat: this.left, side: 'left' }
    if (this.right?.token === token) return { seat: this.right, side: 'right' }
    return null
  }

  private seatAvailable(seat: SeatRecord | null, now: number) {
    if (!seat) return true
    if (seat.socket && seat.socket.readyState === WebSocket.OPEN) return false
    return seat.reservedUntil <= now
  }
}

function freshSeat(token: string, socket: WebSocket): SeatRecord {
  return {
    token,
    socket,
    reservedUntil: 0,
    intent: { ...idleIntent },
  }
}

function isOpen(seat: SeatRecord | null) {
  return seat?.socket?.readyState === WebSocket.OPEN
}
