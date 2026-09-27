import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  filledButtonClass,
  ghostButtonClass,
  PongShell,
} from '#/components/pong-shell'
import { createInvite } from '#/game/match-client'
import { paintCourt } from '#/game/paint'
import {
  AI_SPEED,
  PADDLE_SPEED,
  WINNING_SCORE,
  aiIntent,
  createGame,
  step,
} from '#/game/rules'
import type { PaddleIntent, Status } from '#/game/rules'
import { createTouchPaddles } from '#/game/touch-input'

type Mode = 'pvp' | 'ai'

export function PongGame() {
  const navigate = useNavigate()
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

  const inviteFriend = useCallback(() => {
    const { roomId } = createInvite()
    void navigate({ to: '/play/$roomId', params: { roomId } })
  }, [navigate])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const touch = createTouchPaddles(canvas, () => {
      if (modeRef.current === 'pvp') return 'split'
      if (modeRef.current === 'ai') return 'left'
      return null
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (['w', 's', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
        event.preventDefault()
      }
      keysRef.current.add(event.key.toLowerCase())
      if (
        event.key === ' ' &&
        gameRef.current.status === 'finished' &&
        modeRef.current
      ) {
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
      const activeMode = modeRef.current
      if (gameRef.current.status === 'playing' && activeMode) {
        const current = gameRef.current
        const rightIntent: PaddleIntent =
          activeMode === 'ai'
            ? aiIntent(current.right.y, current.ball)
            : {
                up: keysRef.current.has('arrowup'),
                down: keysRef.current.has('arrowdown'),
                targetY: touch.read('right'),
              }
        const next = step(
          current,
          {
            left: {
              up: keysRef.current.has('w'),
              down: keysRef.current.has('s'),
              targetY: touch.read('left'),
            },
            right: rightIntent,
          },
          delta,
          Math.random,
          {
            left: PADDLE_SPEED,
            right: activeMode === 'ai' ? AI_SPEED : PADDLE_SPEED,
          },
        )
        gameRef.current = next
        if (next.status === 'finished') setStatus('finished')
        if (next.leftScore !== shownLeft || next.rightScore !== shownRight) {
          shownLeft = next.leftScore
          shownRight = next.rightScore
          setScores({ left: shownLeft, right: shownRight })
        }
      }

      const game = gameRef.current
      paintCourt(context, {
        leftY: game.left.y,
        rightY: game.right.y,
        ballX: game.ball.x,
        ballY: game.ball.y,
      })
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      touch.dispose()
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
    mode === 'ai'
      ? 'Local arcade // vs cpu'
      : mode === 'pvp'
        ? 'Local arcade // two player'
        : 'Local arcade // select mode'

  return (
    <PongShell
      subtitle={subtitle}
      rightLabel={rightLabel}
      scores={scores}
      canvasRef={canvasRef}
      overlay={
        <>
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
                  className={filledButtonClass}
                >
                  Player 1 vs Player 2
                </button>
                <button
                  type="button"
                  onClick={() => startMode('ai')}
                  className={ghostButtonClass}
                >
                  Player 1 vs AI
                </button>
                <button
                  type="button"
                  onClick={inviteFriend}
                  className={ghostButtonClass}
                >
                  Invite a friend
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
                className={`mt-7 ${filledButtonClass}`}
              >
                Play again
              </button>
              <button
                type="button"
                onClick={changeMode}
                className={`mt-3 ${ghostButtonClass}`}
              >
                Change mode
              </button>
              <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/45">
                or press space
              </p>
            </div>
          )}
        </>
      }
      footer={
        <>
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
        </>
      }
    />
  )
}
