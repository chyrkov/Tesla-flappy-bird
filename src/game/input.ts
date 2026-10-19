const PRIMARY_KEYS = new Set(['Space', 'ArrowUp', 'KeyW'])
const PAUSE_KEYS = new Set(['KeyP', 'Escape'])
const MUTE_KEY = 'KeyM'

export interface InputHandlers {
  onPrimary: () => void
  onPause: () => void
  onMute: () => void
}

export function bindInput(root: HTMLElement, handlers: InputHandlers): void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (PRIMARY_KEYS.has(event.code)) {
      event.preventDefault()
      if (!event.repeat) handlers.onPrimary()
      return
    }
    if (event.repeat) return
    if (PAUSE_KEYS.has(event.code)) handlers.onPause()
    if (event.code === MUTE_KEY) handlers.onMute()
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button, a')) return
    event.preventDefault()
    handlers.onPrimary()
  }

  const handleContextMenu = (event: MouseEvent) => event.preventDefault()

  window.addEventListener('keydown', handleKeyDown)
  root.addEventListener('pointerdown', handlePointerDown)
  root.addEventListener('contextmenu', handleContextMenu)
}
