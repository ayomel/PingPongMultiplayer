import { useCallback, useEffect, useRef, useState } from 'react'

const WIDTH = 1000
const HEIGHT = 600
const WINNING_SCORE = 7
const PADDLE_WIDTH = 12
const PADDLE_HEIGHT = 108
const PADDLE_SPEED = 520
const BALL_RADIUS = 8
const BALL_SPEED = 450
const AI_SPEED = PADDLE_SPEED * 0.5
const AI_DEADZONE = 8

type Status = 'playing' | 'finished'
type Mode = 'pvp' | 'ai'
type Ball = { x: number; y: number; vx: number; vy: number }

function createBall(direction = Math.random() > 0.5 ? 1 : -1): Ball {
  const angle = (Math.random() * 0.8 - 0.4) * Math.PI
  return {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: Math.cos(angle) * BALL_SPEED * direction,
    vy: Math.sin(angle) * BALL_SPEED,
  }
}

function moveAiPaddle(
  paddle: { y: number },
  ball: Ball,
  delta: number,
) {
  const paddleCenter = paddle.y + PADDLE_HEIGHT / 2
  const target = ball.vx > 0 ? ball.y : HEIGHT / 2
  const diff = target - paddleCenter
  if (Math.abs(diff) <= AI_DEADZONE) return
  const step = Math.min(Math.abs(diff), AI_SPEED * delta)
  paddle.y += Math.sign(diff) * step
}

function createGame() {
  return {
    left: { x: 34, y: HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    right: { x: WIDTH - 46, y: HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    ball: createBall(),
    leftScore: 0,
    rightScore: 0,
    status: 'playing' as Status,
  }
}

export function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keysRef = useRef(new Set<string>())
  const gameRef = useRef(createGame())
  const modeRef = useRef<Mode | null>(null)
  const [scores, setScores] = useState({ left: 0, right: 0 })
  const [status, setStatus] = useState<Status>('playing')
  const [mode, setMode] = useState<Mode | null>(null)

  const resetGame = useCallback(() => {
    gameRef.current = createGame()
    setScores({ left: 0, right: 0 })
    setStatus('playing')
  }, [])

  const startMode = useCallback(
    (next: Mode) => {
      modeRef.current = next
      setMode(next)
      resetGame()
    },
    [resetGame],
  )

  const changeMode = useCallback(() => {
    modeRef.current = null
    setMode(null)
    resetGame()
  }, [resetGame])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (['w', 's', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
        event.preventDefault()
      }
      keysRef.current.add(event.key.toLowerCase())
      if (event.key === ' ' && gameRef.current.status === 'finished') {
        resetGame()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key.toLowerCase())
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let frame = 0
    let previous = performance.now()
    let shownLeft = 0
    let shownRight = 0

    const loop = (time: number) => {
      const delta = Math.min((time - previous) / 1000, 0.05)
      previous = time
      const game = gameRef.current

      const activeMode = modeRef.current
      if (game.status === 'playing' && activeMode) {
        if (keysRef.current.has('w')) game.left.y -= PADDLE_SPEED * delta
        if (keysRef.current.has('s')) game.left.y += PADDLE_SPEED * delta
        if (activeMode === 'pvp') {
          if (keysRef.current.has('arrowup')) {
            game.right.y -= PADDLE_SPEED * delta
          }
          if (keysRef.current.has('arrowdown')) {
            game.right.y += PADDLE_SPEED * delta
          }
        } else {
          moveAiPaddle(game.right, game.ball, delta)
        }
        game.left.y = Math.max(0, Math.min(HEIGHT - PADDLE_HEIGHT, game.left.y))
        game.right.y = Math.max(
          0,
          Math.min(HEIGHT - PADDLE_HEIGHT, game.right.y),
        )

        const ball = game.ball
        ball.x += ball.vx * delta
        ball.y += ball.vy * delta
        if (ball.y - BALL_RADIUS <= 0 || ball.y + BALL_RADIUS >= HEIGHT) {
          ball.y = Math.max(BALL_RADIUS, Math.min(HEIGHT - BALL_RADIUS, ball.y))
          ball.vy *= -1
        }

        const movingRight = ball.vx > 0
        const paddle = movingRight ? game.right : game.left
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
          const hit =
            (ball.y - (paddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2)
          ball.vy = hit * BALL_SPEED
        }

        if (ball.x < -BALL_RADIUS) {
          game.rightScore += 1
          ball.x = WIDTH / 2
          ball.y = HEIGHT / 2
          ball.vx = BALL_SPEED
          ball.vy = (Math.random() - 0.5) * BALL_SPEED
        } else if (ball.x > WIDTH + BALL_RADIUS) {
          game.leftScore += 1
          ball.x = WIDTH / 2
          ball.y = HEIGHT / 2
          ball.vx = -BALL_SPEED
          ball.vy = (Math.random() - 0.5) * BALL_SPEED
        }
        if (
          game.leftScore >= WINNING_SCORE ||
          game.rightScore >= WINNING_SCORE
        ) {
          game.status = 'finished'
          setStatus('finished')
        }
        if (game.leftScore !== shownLeft || game.rightScore !== shownRight) {
          shownLeft = game.leftScore
          shownRight = game.rightScore
          setScores({ left: shownLeft, right: shownRight })
        }
      }

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
      context.fillRect(game.left.x, game.left.y, PADDLE_WIDTH, PADDLE_HEIGHT)
      context.fillRect(game.right.x, game.right.y, PADDLE_WIDTH, PADDLE_HEIGHT)
      context.beginPath()
      context.arc(game.ball.x, game.ball.y, BALL_RADIUS, 0, Math.PI * 2)
      context.fill()
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [resetGame])

  const rightLabel = mode === 'ai' ? 'AI' : 'Player 02'
  const winner =
    scores.left >= WINNING_SCORE
      ? 'PLAYER 1'
      : mode === 'ai'
        ? 'AI'
        : 'PLAYER 2'
  const subtitle =
    mode === 'ai' ? 'vs cpu' : mode === 'pvp' ? 'two player' : 'select mode'

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#050505',
        color: '#fff',
        padding: '32px 24px',
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1120,
          minHeight: 'calc(100vh - 64px)',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,.15)',
            paddingBottom: 16,
          }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/45">
              Local arcade // {subtitle}
            </p>
            <h1 className="mt-2 text-2xl font-bold uppercase tracking-[0.12em] sm:text-3xl">
              Pong / 01
            </h1>
          </div>
          <p className="text-right text-[10px] uppercase tracking-[0.2em] text-white/45">
            First to {WINNING_SCORE}
          </p>
        </header>
        <section
          aria-label="Pong game"
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,.2)',
            background: '#000',
          }}
        >
          <div className="flex items-center justify-center gap-10 border-b border-white/10 px-6 py-4 sm:gap-24">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">
                Player 01
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums sm:text-5xl">
                {scores.left}
              </p>
            </div>
            <div className="h-10 w-px bg-white/15" />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">
                {rightLabel}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums sm:text-5xl">
                {scores.right}
              </p>
            </div>
          </div>
          <div className="relative aspect-[5/3] w-full">
            <canvas
              ref={canvasRef}
              width={WIDTH}
              height={HEIGHT}
              className="absolute inset-0 h-full w-full"
              aria-label="Playable Pong canvas"
            />
            {mode === null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-center">
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/55">
                  Choose a match
                </p>
                <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.12em] sm:text-5xl">
                  Select mode
                </h2>
                <div className="mt-7 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => startMode('pvp')}
                    className="border border-white bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-transparent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    Player 1 vs Player 2
                  </button>
                  <button
                    type="button"
                    onClick={() => startMode('ai')}
                    className="border border-white bg-transparent px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    Player 1 vs AI
                  </button>
                </div>
              </div>
            )}
            {mode !== null && status === 'finished' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-center">
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/55">
                  Match complete
                </p>
                <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.12em] sm:text-5xl">
                  {winner} wins
                </h2>
                <button
                  type="button"
                  onClick={resetGame}
                  className="mt-7 border border-white bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-transparent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Play again
                </button>
                <button
                  type="button"
                  onClick={changeMode}
                  className="mt-3 border border-white bg-transparent px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Change mode
                </button>
                <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/45">
                  or press space
                </p>
              </div>
            )}
          </div>
        </section>
        <footer className="flex flex-col gap-3 text-[10px] uppercase tracking-[0.18em] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="text-white/80">P1</span> W / S
            {mode !== 'ai' && (
              <>
                {' '}
                <span className="mx-3 text-white/20">|</span>{' '}
                <span className="text-white/80">P2</span> ↑ / ↓
              </>
            )}
          </p>
          {mode === null ? (
            <p>Choose a mode to begin</p>
          ) : (
            <button
              type="button"
              onClick={changeMode}
              className="text-left uppercase tracking-[0.18em] text-white/45 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Change mode
            </button>
          )}
        </footer>
      </div>
    </main>
  )
}
