import {
  BALL_RADIUS,
  HEIGHT,
  LEFT_X,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  RIGHT_X,
  WIDTH,
} from '#/game/rules'

export function paintCourt(
  context: CanvasRenderingContext2D,
  court: { leftY: number; rightY: number; ballX: number; ballY: number },
) {
  context.fillStyle = '#050505'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  context.setLineDash([12, 18])
  context.strokeStyle = '#252525'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(WIDTH / 2, 0)
  context.lineTo(WIDTH / 2, HEIGHT)
  context.stroke()
  context.setLineDash([])
  context.fillStyle = '#ffffff'
  context.fillRect(LEFT_X, court.leftY, PADDLE_WIDTH, PADDLE_HEIGHT)
  context.fillRect(RIGHT_X, court.rightY, PADDLE_WIDTH, PADDLE_HEIGHT)
  context.beginPath()
  context.arc(court.ballX, court.ballY, BALL_RADIUS, 0, Math.PI * 2)
  context.fill()
}
