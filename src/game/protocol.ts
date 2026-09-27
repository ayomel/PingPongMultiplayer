import { validate, version } from 'uuid'
import { HEIGHT } from '#/game/rules'

export type Seat = 'left' | 'right'
export type MatchPhase = 'waiting' | 'playing' | 'finished' | 'opponent-left'

export type MatchSnapshot = {
  type: 'snapshot'
  phase: MatchPhase
  leftY: number
  rightY: number
  ballX: number
  ballY: number
  leftScore: number
  rightScore: number
}

export type ServerMessage =
  | { type: 'welcome'; seat: Seat }
  | { type: 'rejected'; reason: 'full' }
  | MatchSnapshot

export type ClientMessage =
  | { type: 'join'; token: string }
  | { type: 'paddle'; up: boolean; down: boolean; targetY?: number }
  | { type: 'restart' }

export function isRoomId(value: string): boolean {
  return validate(value) && version(value) === 4
}

export function parseClientMessage(raw: unknown): ClientMessage | null {
  const message = parseRecord(raw)
  if (!message) return null
  if (message.type === 'join') {
    if (typeof message.token !== 'string') return null
    if (message.token.length === 0 || message.token.length > 64) return null
    return { type: 'join', token: message.token }
  }
  if (message.type === 'paddle') {
    if (typeof message.up !== 'boolean' || typeof message.down !== 'boolean')
      return null
    if (message.targetY === undefined) {
      return { type: 'paddle', up: message.up, down: message.down }
    }
    if (
      !isFiniteNumber(message.targetY) ||
      message.targetY < 0 ||
      message.targetY > HEIGHT
    ) {
      return null
    }
    return {
      type: 'paddle',
      up: message.up,
      down: message.down,
      targetY: message.targetY,
    }
  }
  if (message.type === 'restart') return { type: 'restart' }
  return null
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  const message = parseRecord(raw)
  if (!message) return null
  if (
    message.type === 'welcome' &&
    (message.seat === 'left' || message.seat === 'right')
  ) {
    return { type: 'welcome', seat: message.seat }
  }
  if (message.type === 'rejected' && message.reason === 'full') {
    return { type: 'rejected', reason: 'full' }
  }
  if (message.type !== 'snapshot') return null
  if (
    message.phase !== 'waiting' &&
    message.phase !== 'playing' &&
    message.phase !== 'finished' &&
    message.phase !== 'opponent-left'
  ) {
    return null
  }
  if (
    !isFiniteNumber(message.leftY) ||
    !isFiniteNumber(message.rightY) ||
    !isFiniteNumber(message.ballX) ||
    !isFiniteNumber(message.ballY) ||
    !isFiniteNumber(message.leftScore) ||
    !isFiniteNumber(message.rightScore)
  ) {
    return null
  }
  return {
    type: 'snapshot',
    phase: message.phase,
    leftY: message.leftY,
    rightY: message.rightY,
    ballX: message.ballX,
    ballY: message.ballY,
    leftScore: message.leftScore,
    rightScore: message.rightScore,
  }
}

function parseRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string') return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
