import type { Seat } from '#/game/protocol'
import { HEIGHT } from '#/game/rules'

export type TouchLayout = Seat | 'split' | null

export type TouchPaddles = {
  read: (side: Seat) => number | undefined
  clear: () => void
  dispose: () => void
}

export function createTouchPaddles(
  canvas: HTMLCanvasElement,
  layout: () => TouchLayout,
  onChange: () => void = () => {},
): TouchPaddles {
  const pointers = new Map<number, { side: Seat; y: number }>()

  const courtY = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT
    return Math.max(0, Math.min(HEIGHT, y))
  }

  const sideFor = (event: PointerEvent): Seat | null => {
    const current = layout()
    if (current !== 'split') return current
    const rect = canvas.getBoundingClientRect()
    return event.clientX - rect.left < rect.width / 2 ? 'left' : 'right'
  }

  const onDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const side = sideFor(event)
    if (!side) return
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, { side, y: courtY(event) })
    onChange()
  }

  const onMove = (event: PointerEvent) => {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) return
    event.preventDefault()
    pointer.y = courtY(event)
    onChange()
  }

  const onEnd = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return
    onChange()
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onEnd)
  canvas.addEventListener('pointercancel', onEnd)

  return {
    read(side) {
      let y: number | undefined
      for (const pointer of pointers.values()) {
        if (pointer.side === side) y = pointer.y
      }
      return y
    },
    clear() {
      if (pointers.size === 0) return
      pointers.clear()
      onChange()
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onEnd)
      canvas.removeEventListener('pointercancel', onEnd)
      pointers.clear()
    },
  }
}
