import { createFileRoute } from '@tanstack/react-router'
import { PongGame } from '#/components/pong-game'

export const Route = createFileRoute('/')({
  component: PongGame,
})
