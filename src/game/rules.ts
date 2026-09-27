export const WIDTH = 1000
export const HEIGHT = 600
export const WINNING_SCORE = 5
export const PADDLE_WIDTH = 12
export const PADDLE_HEIGHT = 108
export const PADDLE_SPEED = 520
export const BALL_RADIUS = 8
export const BALL_SPEED = 550
export const AI_SPEED = PADDLE_SPEED * 0.5
export const AI_DEADZONE = 8
export const LEFT_X = 34
export const RIGHT_X = WIDTH - 46

export type Status = 'playing' | 'finished'
export type Ball = { x: number; y: number; vx: number; vy: number }
export type Paddle = { x: number; y: number }
export type PaddleIntent = { up: boolean; down: boolean }
export type GameState = {
  left: Paddle
  right: Paddle
  ball: Ball
  leftScore: number
  rightScore: number
  status: Status
}

export const idleIntent: PaddleIntent = { up: false, down: false }

export function createGame(random: () => number = Math.random): GameState {
  return {
    left: { x: LEFT_X, y: HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    right: { x: RIGHT_X, y: HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    ball: createBall(random),
    leftScore: 0,
    rightScore: 0,
    status: 'playing',
  }
}

export function aiIntent(paddleY: number, ball: Ball): PaddleIntent {
  const paddleCenter = paddleY + PADDLE_HEIGHT / 2
  const target = ball.vx > 0 ? ball.y : HEIGHT / 2
  const diff = target - paddleCenter
  if (Math.abs(diff) <= AI_DEADZONE) return idleIntent
  return { up: diff < 0, down: diff > 0 }
}

export function step(
  game: GameState,
  intents: { left: PaddleIntent; right: PaddleIntent },
  dt: number,
  random: () => number = Math.random,
  speeds: { left: number; right: number } = {
    left: PADDLE_SPEED,
    right: PADDLE_SPEED,
  },
): GameState {
  if (game.status === 'finished') return cloneGame(game)

  const next = cloneGame(game)
  movePaddle(next.left, intents.left, speeds.left, dt)
  movePaddle(next.right, intents.right, speeds.right, dt)

  const ball = next.ball
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt
  if (ball.y - BALL_RADIUS <= 0 || ball.y + BALL_RADIUS >= HEIGHT) {
    ball.y = Math.max(BALL_RADIUS, Math.min(HEIGHT - BALL_RADIUS, ball.y))
    ball.vy *= -1
  }

  const movingRight = ball.vx > 0
  const paddle = movingRight ? next.right : next.left
  const overlapsX = movingRight
    ? ball.x + BALL_RADIUS >= paddle.x &&
      ball.x - BALL_RADIUS <= paddle.x + PADDLE_WIDTH
    : ball.x - BALL_RADIUS <= paddle.x + PADDLE_WIDTH &&
      ball.x + BALL_RADIUS >= paddle.x
  const overlapsY =
    ball.y + BALL_RADIUS >= paddle.y &&
    ball.y - BALL_RADIUS <= paddle.y + PADDLE_HEIGHT
  if (overlapsX && overlapsY) {
    ball.x = movingRight
      ? paddle.x - BALL_RADIUS
      : paddle.x + PADDLE_WIDTH + BALL_RADIUS
    ball.vx = -ball.vx
    const hit = (ball.y - (paddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2)
    ball.vy = hit * BALL_SPEED
  }

  if (ball.x < -BALL_RADIUS) {
    next.rightScore += 1
    serve(ball, 1, random)
  } else if (ball.x > WIDTH + BALL_RADIUS) {
    next.leftScore += 1
    serve(ball, -1, random)
  }
  if (next.leftScore >= WINNING_SCORE || next.rightScore >= WINNING_SCORE) {
    next.status = 'finished'
  }
  return next
}

function createBall(
  random: () => number,
  direction = random() > 0.5 ? 1 : -1,
): Ball {
  const angle = (random() * 0.8 - 0.4) * Math.PI
  return {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: Math.cos(angle) * BALL_SPEED * direction,
    vy: Math.sin(angle) * BALL_SPEED,
  }
}

function serve(ball: Ball, direction: 1 | -1, random: () => number) {
  ball.x = WIDTH / 2
  ball.y = HEIGHT / 2
  ball.vx = BALL_SPEED * direction
  ball.vy = (random() - 0.5) * BALL_SPEED
}

function movePaddle(
  paddle: Paddle,
  intent: PaddleIntent,
  speed: number,
  dt: number,
) {
  if (intent.up) paddle.y -= speed * dt
  if (intent.down) paddle.y += speed * dt
  paddle.y = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, paddle.y))
}

function cloneGame(game: GameState): GameState {
  return {
    left: { ...game.left },
    right: { ...game.right },
    ball: { ...game.ball },
    leftScore: game.leftScore,
    rightScore: game.rightScore,
    status: game.status,
  }
}
