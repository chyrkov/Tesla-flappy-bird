import { createAudioEngine } from './audio'
import { createBackground } from './background'
import {
  FIXED_STEP,
  GROUND_Y,
  MAX_FRAME_TIME,
  MAX_VIEW_WIDTH,
  MIN_VIEW_WIDTH,
  PLAYER_LAYOUT,
  TIMING,
  VIEW_HEIGHT,
} from './config'
import { getSpeed } from './difficulty'
import { getElement } from './dom'
import { createGround } from './ground'
import { bindInput } from './input'
import { clamp, randomInt } from './math'
import { createObstacleField } from './obstacles'
import {
  createParticleSystem,
  emitExplosion,
  emitJetBurst,
  emitScoreSparks,
  emitSmoke,
  emitThrusterSmoke,
} from './particles'
import {
  createPlayer,
  flapPlayer,
  getJetPoints,
  getPlayerAngle,
  getPlayerHitbox,
  hoverPlayer,
  killPlayer,
  renderPlayer,
  resetPlayer,
  updatePlayer,
} from './player'
import { createRain } from './rain'
import { createRoadsterSprite, createRoadsterWreckSprite } from './sprites'
import { loadBestScore, loadMuted, saveBestScore, saveMuted } from './storage'
import { createUi } from './ui'

type GameState = 'ready' | 'playing' | 'dying' | 'gameover'

const READY_Y = Math.round(GROUND_Y * PLAYER_LAYOUT.readyYRatio)
const EXHAUST_INTERVAL = 0.04
const SMOKE_INTERVAL = 0.08
const CRASH_SHAKE = 0.45
const CRASH_FLASH = 0.85
const CLEAR_COLOR = '#05010f'

export function startGame(): void {
  const root = getElement('game-root')
  const stage = getElement('stage')
  const canvas = getElement<HTMLCanvasElement>('game-canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is not supported')
  const ctx = context

  const audio = createAudioEngine(loadMuted())
  const background = createBackground()
  const ground = createGround()
  const rain = createRain()
  const particles = createParticleSystem()
  const obstacles = createObstacleField()
  const player = createPlayer()
  const roadsterSprite = createRoadsterSprite()
  const wreckSprite = createRoadsterWreckSprite()

  let viewWidth = MIN_VIEW_WIDTH
  let state: GameState = 'ready'
  let score = 0
  let bestScore = loadBestScore()
  let isNewBest = false
  let isPaused = false
  let isMuted = loadMuted()
  let time = 0
  let stateTime = 0
  let worldScroll = 0
  let shakeTime = 0
  let flashAlpha = 0
  let exhaustTimer = 0
  let smokeTimer = 0
  let accumulator = 0
  let lastTimestamp = performance.now()

  const getPlayerX = () =>
    Math.round(Math.min(viewWidth * PLAYER_LAYOUT.xRatio, PLAYER_LAYOUT.maxX))

  const getWorldSpeed = () => {
    if (state === 'ready') return getSpeed(0)
    if (state === 'playing') return getSpeed(score)
    return 0
  }

  const flap = () => {
    const isFlipStarted = flapPlayer(player)
    if (isFlipStarted) {
      audio.playFlip()
      emitScoreSparks(particles, player.x, player.y)
    }
    for (const jet of getJetPoints(player)) {
      emitJetBurst(particles, jet.x, jet.y, getPlayerAngle(player), 1)
      emitThrusterSmoke(particles, jet.x, jet.y)
      emitThrusterSmoke(particles, jet.x, jet.y)
    }
    audio.playFlap()
  }

  const startPlaying = () => {
    state = 'playing'
    stateTime = 0
    score = 0
    ui.showPlaying()
    ui.setScore(0)
    audio.setMusicMuffled(false)
    flap()
  }

  const resetToReady = () => {
    state = 'ready'
    stateTime = 0
    score = 0
    isNewBest = false
    obstacles.reset()
    particles.clear()
    resetPlayer(player, getPlayerX(), READY_Y)
    ui.showReady(bestScore)
    audio.setMusicMuffled(false)
  }

  const crash = () => {
    state = 'dying'
    stateTime = 0
    killPlayer(player)
    emitExplosion(particles, player.x, player.y)
    shakeTime = CRASH_SHAKE
    flashAlpha = CRASH_FLASH
    audio.playCrash()
    isNewBest = score > bestScore
    if (!isNewBest) return
    bestScore = score
    saveBestScore(score)
  }

  const showGameOver = () => {
    state = 'gameover'
    stateTime = 0
    ui.showGameOver({ score, bestScore, isNewBest })
    audio.setMusicMuffled(true)
    if (isNewBest) audio.playNewBest()
  }

  const setPaused = (value: boolean) => {
    if (value && state !== 'playing') return
    isPaused = value
    ui.setPaused(value)
    if (value) {
      audio.suspend()
      return
    }
    audio.resume()
  }

  const togglePause = () => setPaused(!isPaused)

  const toggleMute = () => {
    audio.unlock()
    isMuted = !isMuted
    audio.setMuted(isMuted)
    saveMuted(isMuted)
    ui.setMuted(isMuted)
  }

  const handlePrimaryAction = () => {
    audio.unlock()
    if (isPaused) {
      setPaused(false)
      return
    }
    if (state === 'ready') {
      startPlaying()
      return
    }
    if (state === 'playing') {
      flap()
      return
    }
    if (state === 'gameover' && stateTime >= TIMING.restartDelay) resetToReady()
  }

  const handleStart = () => {
    audio.unlock()
    if (state === 'ready') startPlaying()
  }

  const handleRestart = () => {
    audio.unlock()
    if (state === 'gameover') resetToReady()
  }

  const ui = createUi({
    onStart: handleStart,
    onRestart: handleRestart,
    onToggleMute: toggleMute,
    onTogglePause: togglePause,
  })

  const emitExhaust = (dt: number) => {
    exhaustTimer -= dt
    if (exhaustTimer > 0) return
    exhaustTimer = EXHAUST_INTERVAL
    const jets = getJetPoints(player)
    for (const jet of jets) emitJetBurst(particles, jet.x, jet.y, getPlayerAngle(player), 0.4)
    if (Math.random() < 0.35) {
      const jet = jets[Math.floor(Math.random() * jets.length)]
      emitThrusterSmoke(particles, jet.x, jet.y)
    }
  }

  const emitWreckSmoke = (dt: number) => {
    smokeTimer -= dt
    if (smokeTimer > 0) return
    smokeTimer = SMOKE_INTERVAL
    emitSmoke(particles, player.x, player.y - 2)
  }

  const updatePlaying = (dt: number, worldSpeed: number) => {
    updatePlayer(player, dt)
    obstacles.update(dt, worldSpeed, viewWidth, score)
    emitExhaust(dt)

    const passed = obstacles.collectPassed(player.x)
    if (passed > 0) {
      score += passed
      ui.setScore(score)
      audio.playScore()
      emitScoreSparks(particles, player.x, player.y)
    }

    const hitbox = getPlayerHitbox(player)
    if (hitbox.y + hitbox.height >= GROUND_Y || obstacles.collides(hitbox)) crash()
  }

  const update = (dt: number) => {
    time += dt
    stateTime += dt
    shakeTime = Math.max(0, shakeTime - dt)
    flashAlpha = Math.max(0, flashAlpha - dt * 3)

    const worldSpeed = getWorldSpeed()
    worldScroll += worldSpeed * dt
    background.update(dt, worldSpeed, viewWidth)
    rain.update(dt, worldSpeed)
    particles.update(dt)

    if (state === 'ready') {
      hoverPlayer(player, READY_Y, time, dt)
      emitExhaust(dt)
      return
    }
    if (state === 'playing') {
      updatePlaying(dt, worldSpeed)
      return
    }

    updatePlayer(player, dt)
    emitWreckSmoke(dt)
    if (state === 'dying' && stateTime >= TIMING.deathToGameOver) showGameOver()
  }

  const render = () => {
    ctx.fillStyle = CLEAR_COLOR
    ctx.fillRect(0, 0, viewWidth, VIEW_HEIGHT)
    ctx.save()
    if (shakeTime > 0) {
      const strength = Math.ceil(shakeTime * 10)
      ctx.translate(
        randomInt(Math.random, -strength, strength),
        randomInt(Math.random, -strength, strength),
      )
    }

    background.render(ctx, viewWidth, worldScroll, time)
    obstacles.render(ctx, time)
    ground.render(ctx, viewWidth, worldScroll)
    renderPlayer(ctx, player, player.isAlive ? roadsterSprite : wreckSprite, time)
    particles.render(ctx)
    rain.render(ctx, viewWidth)
    ctx.restore()

    if (flashAlpha <= 0) return
    ctx.fillStyle = `rgba(255, 240, 255, ${flashAlpha})`
    ctx.fillRect(0, 0, viewWidth, VIEW_HEIGHT)
  }

  const frame = (timestamp: number) => {
    const frameTime = Math.min(Math.max(0, (timestamp - lastTimestamp) / 1000), MAX_FRAME_TIME)
    lastTimestamp = timestamp
    if (!isPaused) {
      accumulator += frameTime
      while (accumulator >= FIXED_STEP) {
        update(FIXED_STEP)
        accumulator -= FIXED_STEP
      }
    }
    render()
    requestAnimationFrame(frame)
  }

  const resize = () => {
    const styles = window.getComputedStyle(root)
    const availableWidth =
      root.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
    const availableHeight =
      root.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom)
    if (availableWidth <= 0 || availableHeight <= 0) return

    viewWidth = clamp(
      Math.round((VIEW_HEIGHT * availableWidth) / availableHeight),
      MIN_VIEW_WIDTH,
      MAX_VIEW_WIDTH,
    )
    canvas.width = viewWidth
    canvas.height = VIEW_HEIGHT
    ctx.imageSmoothingEnabled = false

    const scale = Math.min(availableWidth / viewWidth, availableHeight / VIEW_HEIGHT)
    stage.style.width = `${Math.floor(viewWidth * scale)}px`
    stage.style.height = `${Math.floor(VIEW_HEIGHT * scale)}px`
    if (state === 'ready') player.x = getPlayerX()
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (state === 'playing') setPaused(true)
      audio.suspend()
      return
    }
    if (!isPaused) audio.resume()
  }

  bindInput(root, {
    onPrimary: handlePrimaryAction,
    onPause: togglePause,
    onMute: toggleMute,
  })
  new ResizeObserver(resize).observe(root)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  resize()
  resetToReady()
  ui.setMuted(isMuted)
  requestAnimationFrame(frame)
}
