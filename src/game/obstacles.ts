import { createPixelCanvas, fillPixelCircle, flipVertical } from './canvas'
import { DIFFICULTY, GROUND_Y, NEON } from './config'
import { getGapSize, getSpacing } from './difficulty'
import { clamp, intersects, pick, randomInt, randomRange, type Random, type Rect } from './math'
import { createDroneSprite, DRONE_SPRITE_HEIGHT } from './sprites'

export type ObstacleKind = 'tower' | 'billboard' | 'drone'

interface NeonTrim {
  core: string
  glow: string
}

interface ObstacleArt {
  top: HTMLCanvasElement | null
  bottom: HTMLCanvasElement | null
  trim: NeonTrim
}

export interface Obstacle {
  kind: ObstacleKind
  x: number
  width: number
  gapSize: number
  baseGapCenter: number
  gapCenter: number
  oscAmplitude: number
  oscSpeed: number
  oscPhase: number
  isScored: boolean
  art: ObstacleArt
}

export interface ObstacleField {
  reset: () => void
  update: (dt: number, speed: number, viewWidth: number, score: number) => void
  render: (ctx: CanvasRenderingContext2D, time: number) => void
  collides: (rect: Rect) => boolean
  collectPassed: (playerX: number) => number
}

const TOWER_WIDTH = 28
const BILLBOARD_WIDTH = 36
const BILLBOARD_HEIGHT = 24
const BILLBOARD_EXTRA_MARGIN = 8
const POLE_X = 16
const POLE_WIDTH = 4
const PYLON_ART_X = 11
const PYLON_ART_WIDTH = 14
const PYLON_HITBOX_X = 12
const PYLON_HITBOX_WIDTH = 12
const ORB_HEIGHT = 10
const ORB_GLOW_SIZE = 18
const DRONE_WIDTH = 12
const DRONE_SPACING = 16
const CEILING_OVERHANG = 200
const SPAWN_MARGIN = 32
const DESPAWN_MARGIN = 16

const OBSTACLE_WIDTHS: Record<ObstacleKind, number> = {
  tower: TOWER_WIDTH,
  billboard: BILLBOARD_WIDTH,
  drone: DRONE_WIDTH,
}

const NEON_TRIMS: readonly NeonTrim[] = [
  { core: NEON.pink, glow: '#7a1a6e' },
  { core: NEON.cyan, glow: '#145a78' },
  { core: NEON.yellow, glow: '#6e5418' },
]

const WINDOW_COLORS = [NEON.cyan, NEON.pink, NEON.yellow, NEON.purple, '#ffffff']

export function createObstacleField(): ObstacleField {
  const obstacles: Obstacle[] = []
  const pylonArt = createPylonArt()
  const orbGlow = createOrbGlow()
  const droneSprite = createDroneSprite()
  let elapsed = 0

  const reset = () => {
    obstacles.length = 0
    elapsed = 0
  }

  const update = (dt: number, speed: number, viewWidth: number, score: number) => {
    elapsed += dt
    for (const obstacle of obstacles) {
      obstacle.x -= speed * dt
      const wave = Math.sin(elapsed * obstacle.oscSpeed + obstacle.oscPhase)
      obstacle.gapCenter = obstacle.baseGapCenter + wave * obstacle.oscAmplitude
    }

    while (obstacles.length > 0 && obstacles[0].x + obstacles[0].width < -DESPAWN_MARGIN) {
      obstacles.shift()
    }

    const last = obstacles.at(-1)
    if (!last) {
      obstacles.push(createObstacle(viewWidth + SPAWN_MARGIN, score, null))
      return
    }
    const nextX = last.x + getSpacing(score)
    if (nextX <= viewWidth + SPAWN_MARGIN) obstacles.push(createObstacle(nextX, score, last))
  }

  const render = (ctx: CanvasRenderingContext2D, time: number) => {
    for (const obstacle of obstacles) {
      if (obstacle.kind === 'tower') renderTower(ctx, obstacle, time)
      if (obstacle.kind === 'billboard') renderBillboard(ctx, obstacle, pylonArt, orbGlow, time)
      if (obstacle.kind === 'drone') renderDroneWall(ctx, obstacle, droneSprite, time)
    }
  }

  const collides = (rect: Rect) =>
    obstacles.some((obstacle) => getHitboxes(obstacle).some((hitbox) => intersects(rect, hitbox)))

  const collectPassed = (playerX: number) => {
    let passed = 0
    for (const obstacle of obstacles) {
      if (obstacle.isScored || obstacle.x + obstacle.width / 2 >= playerX) continue
      obstacle.isScored = true
      passed++
    }
    return passed
  }

  return { reset, update, render, collides, collectPassed }
}

function getAvailableKinds(score: number): readonly ObstacleKind[] {
  if (score >= DIFFICULTY.dronesFromScore) return ['tower', 'billboard', 'drone']
  if (score >= DIFFICULTY.billboardsFromScore) return ['tower', 'tower', 'billboard']
  return ['tower']
}

function createObstacle(x: number, score: number, previous: Obstacle | null): Obstacle {
  const kind = pick(Math.random, getAvailableKinds(score))
  const gapSize = getGapSize(score)
  const oscAmplitude =
    kind === 'drone' ? Math.min(6 + (score - DIFFICULTY.dronesFromScore) * 0.8, 22) : 0
  const topMargin = kind === 'billboard' ? BILLBOARD_EXTRA_MARGIN : 0
  const minCenter = DIFFICULTY.gapMargin + gapSize / 2 + oscAmplitude + topMargin
  const maxCenter = GROUND_Y - DIFFICULTY.gapMargin - gapSize / 2 - oscAmplitude

  let center = randomRange(Math.random, minCenter, maxCenter)
  if (previous) {
    center = clamp(
      center,
      previous.baseGapCenter - DIFFICULTY.maxGapShift,
      previous.baseGapCenter + DIFFICULTY.maxGapShift,
    )
  }
  center = clamp(center, minCenter, maxCenter)

  const oscPhase = Math.random() * Math.PI * 2
  return {
    kind,
    x,
    width: OBSTACLE_WIDTHS[kind],
    gapSize,
    baseGapCenter: center,
    gapCenter: center + Math.sin(oscPhase) * oscAmplitude,
    oscAmplitude,
    oscSpeed: randomRange(Math.random, 1.4, 2.2),
    oscPhase,
    isScored: false,
    art: createObstacleArt(kind),
  }
}

function createObstacleArt(kind: ObstacleKind): ObstacleArt {
  const trim = pick(Math.random, NEON_TRIMS)
  if (kind === 'tower') {
    return {
      top: flipVertical(createTowerArt(Math.random, trim)),
      bottom: createTowerArt(Math.random, trim),
      trim,
    }
  }
  if (kind === 'billboard')
    return { top: createBillboardArt(Math.random, trim), bottom: null, trim }
  return { top: null, bottom: null, trim }
}

function getGapEdges(obstacle: Obstacle): { top: number; bottom: number } {
  return {
    top: obstacle.gapCenter - obstacle.gapSize / 2,
    bottom: obstacle.gapCenter + obstacle.gapSize / 2,
  }
}

function getHitboxes(obstacle: Obstacle): Rect[] {
  const { top, bottom } = getGapEdges(obstacle)
  const bottomHeight = GROUND_Y - bottom

  if (obstacle.kind === 'billboard') {
    const panelTop = top - BILLBOARD_HEIGHT
    return [
      { x: obstacle.x, y: panelTop, width: BILLBOARD_WIDTH, height: BILLBOARD_HEIGHT },
      {
        x: obstacle.x + POLE_X,
        y: -CEILING_OVERHANG,
        width: POLE_WIDTH,
        height: panelTop + CEILING_OVERHANG,
      },
      {
        x: obstacle.x + PYLON_HITBOX_X,
        y: bottom,
        width: PYLON_HITBOX_WIDTH,
        height: bottomHeight,
      },
    ]
  }

  const inset = obstacle.kind === 'drone' ? 1 : 0
  const width = obstacle.width - inset * 2
  return [
    { x: obstacle.x + inset, y: -CEILING_OVERHANG, width, height: top + CEILING_OVERHANG },
    { x: obstacle.x + inset, y: bottom, width, height: bottomHeight },
  ]
}

function createTowerArt(random: Random, trim: NeonTrim): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TOWER_WIDTH, GROUND_Y)

  ctx.fillStyle = '#1d0f3d'
  ctx.fillRect(0, 0, TOWER_WIDTH, GROUND_Y)
  ctx.fillStyle = '#3c2373'
  ctx.fillRect(0, 0, 2, GROUND_Y)
  ctx.fillStyle = '#120827'
  ctx.fillRect(TOWER_WIDTH - 2, 0, 2, GROUND_Y)

  ctx.fillStyle = trim.core
  ctx.fillRect(0, 0, TOWER_WIDTH, 2)
  ctx.fillStyle = trim.glow
  ctx.fillRect(0, 2, TOWER_WIDTH, 1)

  ctx.fillStyle = '#0d0620'
  ctx.fillRect(2, 5, TOWER_WIDTH - 4, 7)
  ctx.fillStyle = trim.core
  for (let y = 6; y < 11; y++) {
    for (let x = 4; x < TOWER_WIDTH - 4; x++) {
      if (random() < 0.4) ctx.fillRect(x, y, 1, 1)
    }
  }

  let floor = 0
  for (let y = 16; y < GROUND_Y - 4; y += 5) {
    floor++
    if (floor % 7 === 0) {
      ctx.fillStyle = '#2e1a5c'
      ctx.fillRect(0, y + 1, TOWER_WIDTH, 2)
      continue
    }
    const litChance = randomRange(random, 0.2, 0.6)
    for (let x = 5; x + 2 <= TOWER_WIDTH - 5; x += 4) {
      ctx.fillStyle = random() < litChance ? pick(random, WINDOW_COLORS) : '#2a1850'
      ctx.fillRect(x, y, 2, 3)
    }
  }

  return canvas
}

function createBillboardArt(random: Random, trim: NeonTrim): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(BILLBOARD_WIDTH, BILLBOARD_HEIGHT)

  ctx.fillStyle = '#1a0636'
  ctx.fillRect(0, 0, BILLBOARD_WIDTH, BILLBOARD_HEIGHT)
  ctx.fillStyle = '#240a4a'
  for (let y = 1; y < BILLBOARD_HEIGHT; y += 2) ctx.fillRect(1, y, BILLBOARD_WIDTH - 2, 1)

  ctx.fillStyle = trim.core
  ctx.fillRect(0, 0, BILLBOARD_WIDTH, 1)
  ctx.fillRect(0, BILLBOARD_HEIGHT - 1, BILLBOARD_WIDTH, 1)
  ctx.fillRect(0, 0, 1, BILLBOARD_HEIGHT)
  ctx.fillRect(BILLBOARD_WIDTH - 1, 0, 1, BILLBOARD_HEIGHT)

  const accent = pick(
    random,
    NEON_TRIMS.filter((candidate) => candidate !== trim),
  ).core
  fillPixelCircle(ctx, 8, 12, 5, accent)
  fillPixelCircle(ctx, 8, 12, 3, '#1a0636')
  fillPixelCircle(ctx, 8, 12, 1, '#ffffff')

  for (let row = 0; row < 4; row++) {
    const y = 5 + row * 4
    const isHeadline = row === 0
    ctx.fillStyle = isHeadline ? '#ffffff' : trim.core
    let x = 17
    while (x < BILLBOARD_WIDTH - 3) {
      const wordLength = randomInt(random, 2, 5)
      ctx.fillRect(x, y, Math.min(wordLength, BILLBOARD_WIDTH - 3 - x), isHeadline ? 2 : 1)
      x += wordLength + 1
    }
  }

  return canvas
}

function createPylonArt(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(PYLON_ART_WIDTH, GROUND_Y)
  const columnTop = ORB_HEIGHT - 2

  ctx.fillStyle = '#2b2140'
  ctx.fillRect(2, columnTop, 10, GROUND_Y)
  ctx.fillStyle = '#4a3d6a'
  ctx.fillRect(2, columnTop, 2, GROUND_Y)
  ctx.fillStyle = '#17112a'
  ctx.fillRect(10, columnTop, 2, GROUND_Y)

  for (let y = ORB_HEIGHT + 4; y < GROUND_Y; y += 10) {
    ctx.fillStyle = '#145a78'
    ctx.fillRect(1, y, 12, 3)
    ctx.fillStyle = NEON.cyan
    ctx.fillRect(1, y + 1, 12, 1)
  }

  fillPixelCircle(ctx, 7, 5, 5, NEON.cyan)
  fillPixelCircle(ctx, 7, 5, 3, '#a8f7ff')
  fillPixelCircle(ctx, 7, 5, 1, '#ffffff')
  return canvas
}

function createOrbGlow(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(ORB_GLOW_SIZE, ORB_GLOW_SIZE)
  fillPixelCircle(ctx, ORB_GLOW_SIZE / 2, ORB_GLOW_SIZE / 2, 8, NEON.cyan)
  return canvas
}

function renderTower(ctx: CanvasRenderingContext2D, obstacle: Obstacle, time: number): void {
  const { top, bottom } = getGapEdges(obstacle)
  const x = Math.round(obstacle.x)
  const topHeight = Math.round(top)
  const bottomY = Math.round(bottom)
  const bottomHeight = GROUND_Y - bottomY

  if (obstacle.art.top && topHeight > 0) {
    ctx.drawImage(
      obstacle.art.top,
      0,
      GROUND_Y - topHeight,
      TOWER_WIDTH,
      topHeight,
      x,
      0,
      TOWER_WIDTH,
      topHeight,
    )
  }
  if (obstacle.art.bottom && bottomHeight > 0) {
    ctx.drawImage(
      obstacle.art.bottom,
      0,
      0,
      TOWER_WIDTH,
      bottomHeight,
      x,
      bottomY,
      TOWER_WIDTH,
      bottomHeight,
    )
  }

  const chaser = Math.floor((time * 48) % (TOWER_WIDTH - 2))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x + chaser, bottomY, 2, 2)
  ctx.fillRect(x + TOWER_WIDTH - 2 - chaser, topHeight - 2, 2, 2)
}

function renderBillboard(
  ctx: CanvasRenderingContext2D,
  obstacle: Obstacle,
  pylonArt: HTMLCanvasElement,
  orbGlow: HTMLCanvasElement,
  time: number,
): void {
  const { top, bottom } = getGapEdges(obstacle)
  const x = Math.round(obstacle.x)
  const panelY = Math.round(top) - BILLBOARD_HEIGHT
  const pylonY = Math.round(bottom)

  if (panelY > 0) {
    ctx.fillStyle = '#2b2140'
    ctx.fillRect(x + POLE_X, 0, POLE_WIDTH, panelY)
    ctx.fillStyle = '#4a3d6a'
    ctx.fillRect(x + POLE_X, 0, 1, panelY)
  }

  if (obstacle.art.top) {
    const isFlickering = Math.random() < 0.04
    const glitchOffset = Math.random() < 0.03 ? (Math.random() < 0.5 ? -2 : 2) : 0
    ctx.fillStyle = obstacle.art.trim.core
    ctx.globalAlpha = 0.22
    ctx.fillRect(x - 2, panelY - 2, BILLBOARD_WIDTH + 4, BILLBOARD_HEIGHT + 4)
    ctx.globalAlpha = isFlickering ? 0.5 : 0.92
    ctx.drawImage(obstacle.art.top, x + glitchOffset, panelY)
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 0.35
    ctx.fillRect(x + 1, panelY + Math.floor((time * 20) % BILLBOARD_HEIGHT), BILLBOARD_WIDTH - 2, 1)
    ctx.globalAlpha = 1
  }

  const pylonHeight = GROUND_Y - pylonY
  if (pylonHeight <= 0) return
  ctx.drawImage(
    pylonArt,
    0,
    0,
    PYLON_ART_WIDTH,
    pylonHeight,
    x + PYLON_ART_X,
    pylonY,
    PYLON_ART_WIDTH,
    pylonHeight,
  )

  const orbCenterX = x + PYLON_ART_X + 7
  ctx.globalAlpha = 0.3 + 0.15 * Math.sin(time * 8)
  ctx.drawImage(orbGlow, orbCenterX - ORB_GLOW_SIZE / 2, pylonY + 5 - ORB_GLOW_SIZE / 2)
  ctx.globalAlpha = 1
  renderArc(ctx, orbCenterX, pylonY)
}

function renderArc(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  if (Math.random() > 0.35) return
  ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#a8f7ff'
  const length = randomInt(Math.random, 3, 6)
  let arcX = x
  for (let i = 1; i <= length; i++) {
    arcX += randomInt(Math.random, -1, 1)
    ctx.fillRect(arcX, y - i, 1, 1)
  }
}

function renderDroneWall(
  ctx: CanvasRenderingContext2D,
  obstacle: Obstacle,
  droneSprite: HTMLCanvasElement,
  time: number,
): void {
  const { top, bottom } = getGapEdges(obstacle)
  const x = Math.round(obstacle.x)
  const topY = Math.round(top)
  const bottomY = Math.round(bottom)
  const laserX = x + DRONE_WIDTH / 2 - 1

  renderLaser(ctx, laserX, 0, topY - 3)
  renderLaser(ctx, laserX, bottomY + 3, GROUND_Y)

  let index = 0
  for (let y = topY - DRONE_SPRITE_HEIGHT; y > -DRONE_SPRITE_HEIGHT; y -= DRONE_SPACING) {
    renderDrone(ctx, droneSprite, x, y, time, index++)
  }
  for (let y = bottomY + 1; y < GROUND_Y; y += DRONE_SPACING) {
    renderDrone(ctx, droneSprite, x, y, time, index++)
  }
}

function renderLaser(ctx: CanvasRenderingContext2D, x: number, fromY: number, toY: number): void {
  const height = toY - fromY
  if (height <= 0) return
  ctx.fillStyle = NEON.red
  ctx.globalAlpha = 0.25
  ctx.fillRect(x - 2, fromY, 6, height)
  ctx.globalAlpha = 0.75 + Math.random() * 0.25
  ctx.fillRect(x, fromY, 2, height)
  ctx.fillStyle = '#ffd0d8'
  ctx.globalAlpha = 0.6
  ctx.fillRect(x, fromY, 1, height)
  ctx.globalAlpha = 1
}

function renderDrone(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  time: number,
  index: number,
): void {
  const bob = Math.round(Math.sin(time * 6 + index))
  const isRotorWide = Math.floor(time * 30 + index) % 2 === 0
  const droneY = y + bob

  ctx.fillStyle = '#9a9ac0'
  if (isRotorWide) {
    ctx.fillRect(x, droneY - 1, 4, 1)
    ctx.fillRect(x + DRONE_WIDTH - 4, droneY - 1, 4, 1)
  } else {
    ctx.fillRect(x + 1, droneY - 1, 2, 1)
    ctx.fillRect(x + DRONE_WIDTH - 3, droneY - 1, 2, 1)
  }
  ctx.drawImage(sprite, x, droneY)
}
