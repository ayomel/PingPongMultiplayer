import type { ReactNode, RefObject } from 'react'
import { HEIGHT, WIDTH, WINNING_SCORE } from '#/game/rules'

export const filledButtonClass =
  'border border-white bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-transparent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black'

export const ghostButtonClass =
  'border border-white bg-transparent px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black'

export function PongShell({
  subtitle,
  rightLabel,
  scores,
  canvasRef,
  overlay,
  footer,
}: {
  subtitle: string
  rightLabel: string
  scores: { left: number; right: number }
  canvasRef: RefObject<HTMLCanvasElement | null>
  overlay?: ReactNode
  footer: ReactNode
}) {
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
              {subtitle}
            </p>
            <h1 className="mt-2 text-2xl font-bold uppercase tracking-[0.12em] sm:text-3xl">
              Pong Game
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
              className="absolute inset-0 h-full w-full touch-none select-none"
              aria-label="Playable Pong canvas"
            />
            {overlay}
          </div>
        </section>
        <footer className="flex flex-col gap-3 text-[10px] uppercase tracking-[0.18em] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          {footer}
        </footer>
      </div>
    </main>
  )
}
