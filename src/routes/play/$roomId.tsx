import { Link, createFileRoute } from '@tanstack/react-router'
import copy from 'copy-to-clipboard'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  filledButtonClass,
  ghostButtonClass,
  PongShell,
} from '#/components/pong-shell'
import { joinMatch } from '#/game/match-client'
import type { MatchSession, MatchView } from '#/game/match-client'
import { paintCourt } from '#/game/paint'
import { isRoomId } from '#/game/protocol'
import { WINNING_SCORE, createGame } from '#/game/rules'
import type { PaddleIntent } from '#/game/rules'

export const Route = createFileRoute('/play/$roomId')({
  component: PlayPage,
})

function PlayPage() {
  const { roomId } = Route.useParams()
  if (!isRoomId(roomId)) return <InvalidInvite />
  return <OnlineMatch roomId={roomId} />
}

function OnlineMatch({ roomId }: { roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sessionRef = useRef<MatchSession | null>(null)
  const viewRef = useRef<MatchView>({ kind: 'connecting' })
  const intentRef = useRef<PaddleIntent>({ up: false, down: false })
  const [view, setView] = useState<MatchView>({ kind: 'connecting' })
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setInviteUrl(window.location.href)
    const session = joinMatch(roomId)
    sessionRef.current = session
    const stop = session.onSnapshot((next) => {
      viewRef.current = next
      setView(next)
    })
    return () => {
      stop()
      session.leave()
      sessionRef.current = null
    }
  }, [roomId])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const opening = createGame(() => 0.5)
    let frame = 0
    const loop = () => {
      const current = viewRef.current
      if (current.kind === 'live') {
        paintCourt(context, {
          leftY: current.snapshot.leftY,
          rightY: current.snapshot.rightY,
          ballX: current.snapshot.ballX,
          ballY: current.snapshot.ballY,
        })
      } else {
        paintCourt(context, {
          leftY: opening.left.y,
          rightY: opening.right.y,
          ballX: opening.ball.x,
          ballY: opening.ball.y,
        })
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const keys = new Set<string>()
    const publish = () => {
      const intent = {
        up: keys.has('w') || keys.has('arrowup'),
        down: keys.has('s') || keys.has('arrowdown'),
      }
      intentRef.current = intent
      sessionRef.current?.sendPaddle(intent)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (['w', 's', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
        event.preventDefault()
      }
      keys.add(event.key.toLowerCase())
      if (event.key === ' ') {
        const current = viewRef.current
        if (current.kind === 'live' && current.snapshot.phase === 'finished') {
          sessionRef.current?.sendRestart()
        }
      }
      publish()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase())
      publish()
    }
    const onBlur = () => {
      keys.clear()
      publish()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    const heartbeat = window.setInterval(publish, 100)
    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const snapshot = view.kind === 'live' ? view.snapshot : null
  const scores = {
    left: snapshot?.leftScore ?? 0,
    right: snapshot?.rightScore ?? 0,
  }
  const winner = scores.left >= WINNING_SCORE ? 'PLAYER 1' : 'PLAYER 2'

  return (
    <PongShell
      subtitle="Remote match // invite"
      rightLabel="Player 02"
      scores={scores}
      canvasRef={canvasRef}
      overlay={
        <MatchOverlay
          view={view}
          inviteUrl={inviteUrl}
          copied={copied}
          winner={winner}
          onCopy={() => {
            void copy(inviteUrl).then((ok) => {
              if (ok) setCopied(true)
            })
          }}
          onRestart={() => sessionRef.current?.sendRestart()}
        />
      }
      footer={
        <>
          <p>
            <span className="text-white/80">You</span> W / S or ↑ / ↓
          </p>
          <Link
            to="/"
            className="uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
          >
            Leave match
          </Link>
        </>
      }
    />
  )
}

function MatchOverlay({
  view,
  inviteUrl,
  copied,
  winner,
  onCopy,
  onRestart,
}: {
  view: MatchView
  inviteUrl: string
  copied: boolean
  winner: string
  onCopy: () => void
  onRestart: () => void
}) {
  if (view.kind === 'full') {
    return (
      <Overlay>
        <p className="text-[10px] uppercase tracking-[0.35em] text-white/55">
          Invite
        </p>
        <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.12em] sm:text-5xl">
          Match full
        </h2>
        <Link to="/" className={`mt-7 ${filledButtonClass}`}>
          Back home
        </Link>
      </Overlay>
    )
  }

  if (view.kind === 'connecting') {
    return (
      <Overlay>
        <p className="text-[10px] uppercase tracking-[0.35em] text-white/55">
          Invite
        </p>
        <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.12em] sm:text-5xl">
          Connecting
        </h2>
      </Overlay>
    )
  }

  if (view.snapshot.phase === 'waiting') {
    return (
      <Overlay>
        <p className="text-[10px] uppercase tracking-[0.35em] text-white/55">
          Invite
        </p>
        <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.12em] sm:text-5xl">
          Waiting for opponent
        </h2>
        <p className="mt-4 max-w-md break-all px-6 text-[10px] uppercase tracking-[0.14em] text-white/55">
          {inviteUrl}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className={`mt-7 ${filledButtonClass}`}
        >
          {copied ? 'Link copied' : 'Copy invite link'}
        </button>
      </Overlay>
    )
  }

  if (view.snapshot.phase === 'opponent-left') {
    return (
      <Overlay>
        <p className="text-[10px] uppercase tracking-[0.35em] text-white/55">
          Invite
        </p>
        <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.12em] sm:text-5xl">
          Opponent disconnected
        </h2>
        <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/45">
          The seat is held for a moment
        </p>
      </Overlay>
    )
  }

  if (view.snapshot.phase === 'finished') {
    return (
      <Overlay>
        <p className="text-[10px] uppercase tracking-[0.35em] text-white/55">
          Match complete
        </p>
        <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.12em] sm:text-5xl">
          {winner} wins
        </h2>
        <button
          type="button"
          onClick={onRestart}
          className={`mt-7 ${filledButtonClass}`}
        >
          Play again
        </button>
        <Link to="/" className={`mt-3 ${ghostButtonClass}`}>
          Leave match
        </Link>
        <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/45">
          or press space
        </p>
      </Overlay>
    )
  }

  return null
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 px-6 text-center">
      {children}
    </div>
  )
}

function InvalidInvite() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  return (
    <PongShell
      subtitle="Remote match // invite"
      rightLabel="Player 02"
      scores={{ left: 0, right: 0 }}
      canvasRef={canvasRef}
      overlay={
        <Overlay>
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/55">
            Invite
          </p>
          <h2 className="mt-3 text-3xl font-bold uppercase tracking-[0.12em] sm:text-5xl">
            Invalid link
          </h2>
          <Link to="/" className={`mt-7 ${filledButtonClass}`}>
            Back home
          </Link>
        </Overlay>
      }
      footer={<p>This invite link is not valid</p>}
    />
  )
}
