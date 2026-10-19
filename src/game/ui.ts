import { getElement } from './dom'

export interface UiHandlers {
  onStart: () => void
  onRestart: () => void
  onToggleMute: () => void
  onTogglePause: () => void
}

export interface GameOverResult {
  score: number
  bestScore: number
  isNewBest: boolean
}

export interface GameUi {
  showReady: (bestScore: number) => void
  showPlaying: () => void
  showGameOver: (result: GameOverResult) => void
  setScore: (score: number) => void
  setPaused: (isPaused: boolean) => void
  setMuted: (isMuted: boolean) => void
}

const SCORE_BUMP: Keyframe[] = [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }]

export function createUi(handlers: UiHandlers): GameUi {
  const score = getElement('score')
  const readyPanel = getElement('ready-panel')
  const readyBest = getElement('ready-best')
  const gameOverPanel = getElement('gameover-panel')
  const finalScore = getElement('final-score')
  const finalBest = getElement('final-best')
  const newBestBadge = getElement('new-best-badge')
  const pausePanel = getElement('pause-panel')
  const pauseButton = getElement<HTMLButtonElement>('pause-button')
  const pauseIcon = getElement('pause-icon')
  const muteButton = getElement<HTMLButtonElement>('mute-button')
  const muteIcon = getElement('mute-icon')

  const bindClick = (id: string, handler: () => void) => {
    const button = getElement<HTMLButtonElement>(id)
    button.addEventListener('click', () => {
      handler()
      button.blur()
    })
  }

  bindClick('start-button', handlers.onStart)
  bindClick('restart-button', handlers.onRestart)
  bindClick('resume-button', handlers.onTogglePause)
  bindClick('pause-button', handlers.onTogglePause)
  bindClick('mute-button', handlers.onToggleMute)

  const showReady = (bestScore: number) => {
    readyBest.textContent = String(bestScore)
    readyPanel.hidden = false
    gameOverPanel.hidden = true
    pausePanel.hidden = true
    score.hidden = true
    pauseButton.hidden = true
  }

  const showPlaying = () => {
    readyPanel.hidden = true
    gameOverPanel.hidden = true
    score.hidden = false
    pauseButton.hidden = false
  }

  const showGameOver = (result: GameOverResult) => {
    finalScore.textContent = String(result.score)
    finalBest.textContent = String(result.bestScore)
    newBestBadge.hidden = !result.isNewBest
    gameOverPanel.hidden = false
    score.hidden = true
    pauseButton.hidden = true
  }

  const setScore = (value: number) => {
    score.textContent = String(value)
    if (value > 0) score.animate(SCORE_BUMP, { duration: 160, easing: 'ease-out' })
  }

  const setPaused = (isPaused: boolean) => {
    pausePanel.hidden = !isPaused
    pauseButton.setAttribute('aria-label', isPaused ? 'Resume game' : 'Pause game')
    pauseIcon.className = `ph-bold ${isPaused ? 'ph-play' : 'ph-pause'}`
  }

  const setMuted = (isMuted: boolean) => {
    muteButton.setAttribute('aria-pressed', String(isMuted))
    muteButton.setAttribute('aria-label', isMuted ? 'Unmute sound' : 'Mute sound')
    muteIcon.className = `ph-bold ${isMuted ? 'ph-speaker-slash' : 'ph-speaker-high'}`
  }

  return { showReady, showPlaying, showGameOver, setScore, setPaused, setMuted }
}
