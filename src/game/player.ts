import { GROUND_Y, PHYSICS } from './config'
import { clamp, randomRange, rotatePoint, type Point, type Rect } from './math'
import { ROADSTER_HEIGHT, ROADSTER_WIDTH } from './sprites'

const HALF_WIDTH = Math.floor(ROADSTER_WIDTH / 2)
const HALF_HEIGHT = Math.floor(ROADSTER_HEIGHT / 2)
const HITBOX_INSET_X = 4
const HITBOX_INSET_TOP = 3
const HITBOX_INSET_BOTTOM = 2
const WRECK_REST_OFFSET = 6
const HOVER_AMPLITUDE = 4
const HEADLIGHT_LENGTH = 14
const IDLE_THRUST = 0.3
const THRUST_DECAY = 2.5
const JET_OFFSETS_X = [-13, -8, 5, 11]
const JET_ORIGIN_Y = HALF_HEIGHT - 1
const JET_COLORS = ['#ffffff', '#d8f2ff', '#9fd8ff', '#5fa8ff']

export interface Player {
  x: number
  y: number
  vy: number
  angle: number
  spin: number
  thrust: number
  isAlive: boolean
}

export function createPlayer(): Player {
  return { x: 0, y: 0, vy: 0, angle: 0, spin: 0, thrust: IDLE_THRUST, isAlive: true }
}

export function resetPlayer(player: Player, x: number, y: number): void {
  Object.assign(player, { x, y, vy: 0, angle: 0, spin: 0, thrust: IDLE_THRUST, isAlive: true })
}

export function hoverPlayer(player: Player, baseY: number, time: number, dt: number): void {
  player.y = baseY + Math.sin(time * 3) * HOVER_AMPLITUDE
  player.angle = Math.cos(time * 3) * -0.06
  player.vy = 0
  player.thrust = IDLE_THRUST + 0.2 * Math.max(0, -Math.cos(time * 3))
  decayThrust(player, dt)
}

export function flapPlayer(player: Player): void {
  player.vy = PHYSICS.flapVelocity
  player.thrust = 1
}

export function killPlayer(player: Player): void {
  player.isAlive = false
  player.thrust = 0
  player.vy = -150
  player.spin = (Math.random() < 0.5 ? -1 : 1) * randomRange(Math.random, 6, 9)
}

export function updatePlayer(player: Player, dt: number): void {
  player.vy = Math.min(player.vy + PHYSICS.gravity * dt, PHYSICS.maxFallSpeed)
  player.y += player.vy * dt

  if (player.isAlive) {
    decayThrust(player, dt)
    if (player.y < PHYSICS.ceilingY) {
      player.y = PHYSICS.ceilingY
      player.vy = Math.max(player.vy, 0)
    }
    const targetAngle = clamp(player.vy * 0.0016, -0.4, 0.7)
    player.angle += (targetAngle - player.angle) * Math.min(1, dt * 14)
    return
  }

  player.angle += player.spin * dt
  const restY = GROUND_Y - WRECK_REST_OFFSET
  if (player.y < restY) return
  player.y = restY
  player.vy = 0
  player.spin = 0
  player.angle = Math.round(player.angle / Math.PI) * Math.PI
}

function decayThrust(player: Player, dt: number): void {
  player.thrust = Math.max(IDLE_THRUST, player.thrust - THRUST_DECAY * dt)
}

export function getPlayerHitbox(player: Player): Rect {
  return {
    x: player.x - HALF_WIDTH + HITBOX_INSET_X,
    y: player.y - HALF_HEIGHT + HITBOX_INSET_TOP,
    width: ROADSTER_WIDTH - HITBOX_INSET_X * 2,
    height: ROADSTER_HEIGHT - HITBOX_INSET_TOP - HITBOX_INSET_BOTTOM,
  }
}

export function getJetPoints(player: Player): Point[] {
  return JET_OFFSETS_X.map((offsetX) => {
    const rotated = rotatePoint({ x: offsetX, y: HALF_HEIGHT + 1 }, player.angle)
    return { x: player.x + rotated.x, y: player.y + rotated.y }
  })
}

export function renderPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  sprite: HTMLCanvasElement,
  time: number,
): void {
  ctx.save()
  ctx.translate(Math.round(player.x), Math.round(player.y))
  ctx.rotate(player.angle)

  if (player.isAlive) {
    renderJets(ctx, player.thrust)
    renderTaillightGlow(ctx, time)
    renderHeadlight(ctx)
  }

  ctx.globalAlpha = 1
  ctx.drawImage(sprite, -HALF_WIDTH, -HALF_HEIGHT)
  ctx.restore()
}

function renderJets(ctx: CanvasRenderingContext2D, thrust: number): void {
  ctx.globalCompositeOperation = 'lighter'
  for (const offsetX of JET_OFFSETS_X) {
    const length = Math.round(3 + thrust * 10 + Math.random() * 2)
    for (let i = 0; i < length; i++) {
      const progress = i / length
      const y = JET_ORIGIN_Y + i
      ctx.fillStyle =
        JET_COLORS[Math.min(JET_COLORS.length - 1, Math.floor(progress * JET_COLORS.length))]
      ctx.globalAlpha = 1 - progress * 0.8
      ctx.fillRect(offsetX, y, 1, 1)
      ctx.globalAlpha = 0.25 * (1 - progress)
      ctx.fillRect(offsetX - 1, y, 3, 1)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}

function renderTaillightGlow(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = '#ff2a3a'
  ctx.globalAlpha = 0.3 + 0.08 * Math.sin(time * 10)
  ctx.fillRect(-HALF_WIDTH - 2, -2, 2, 4)
  ctx.globalAlpha = 0.15
  ctx.fillRect(-HALF_WIDTH - 4, -1, 2, 2)
}

function renderHeadlight(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#e8f6ff'
  for (let i = 0; i < HEADLIGHT_LENGTH; i++) {
    const beamHeight = 1 + Math.floor(i / 3)
    ctx.globalAlpha = 0.28 * (1 - i / HEADLIGHT_LENGTH)
    ctx.fillRect(HALF_WIDTH + 1 + i, -1 - Math.floor(beamHeight / 2), 1, beamHeight)
  }
}
