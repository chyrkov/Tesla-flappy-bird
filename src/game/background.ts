import { createPixelCanvas, fillPixelCircle, flipHorizontal } from './canvas'
import { buildGradientPalette } from './color'
import { GROUND_Y, MAX_VIEW_WIDTH, NEON } from './config'
import {
  createRng,
  isDitherOn,
  pick,
  randomInt,
  randomRange,
  type Point,
  type Random,
} from './math'
import { createHoverCarSprite } from './sprites'

const TILE_WIDTH = 512
const ROOF_SPACE = 20
const SKY_STOPS = ['#05010f', '#0d0326', '#1c0739', '#350c52', '#561262', '#7d1c6c']
const SKY_PALETTE_STEPS = 14
const STATIC_STAR_COUNT = 90
const TWINKLE_STAR_COUNT = 24
const MOON_SIZE = 48
const MOON_RADIUS = 12
const MOON_HALO = 8
const NARROW_VIEW_WIDTH = 240
const HOVER_CAR_COUNT = 6
const HOVER_CAR_MARGIN = 80
const HOVER_CAR_PARALLAX = 0.3

interface SkylineOptions {
  seed: number
  minHeight: number
  maxHeight: number
  minWidth: number
  maxWidth: number
  minGap: number
  maxGap: number
  bodyColor: string
  edgeColor: string
  windowColors: readonly string[]
  windowChance: number
  windowWidth: number
  neonColors: readonly string[]
  neonChance: number
  antennaChance: number
  parallax: number
}

interface BlinkLight {
  x: number
  y: number
  phase: number
}

interface BuildingArt {
  canvas: HTMLCanvasElement
  lights: BlinkLight[]
}

interface SkylineLayer {
  canvas: HTMLCanvasElement
  parallax: number
  lights: BlinkLight[]
}

interface TwinkleStar {
  x: number
  y: number
  phase: number
  speed: number
}

interface HoverCarStyle {
  right: HTMLCanvasElement
  left: HTMLCanvasElement
}

interface HoverCar {
  x: number
  y: number
  speed: number
  sprite: HTMLCanvasElement
  isFacingRight: boolean
}

export interface Background {
  update: (dt: number, worldSpeed: number, viewWidth: number) => void
  render: (ctx: CanvasRenderingContext2D, viewWidth: number, scroll: number, time: number) => void
}

const NEON_COLORS = [NEON.pink, NEON.cyan, NEON.yellow, NEON.purple]

const FAR_SKYLINE: SkylineOptions = {
  seed: 11,
  minHeight: 70,
  maxHeight: 150,
  minWidth: 14,
  maxWidth: 30,
  minGap: -4,
  maxGap: 2,
  bodyColor: '#1a0b33',
  edgeColor: '#251245',
  windowColors: ['#3d2a72', '#4b3384', '#5c3f8f'],
  windowChance: 0.18,
  windowWidth: 1,
  neonColors: ['#7a3a9a'],
  neonChance: 0.08,
  antennaChance: 0.35,
  parallax: 0.08,
}

const MID_SKYLINE: SkylineOptions = {
  seed: 23,
  minHeight: 40,
  maxHeight: 120,
  minWidth: 16,
  maxWidth: 36,
  minGap: -2,
  maxGap: 6,
  bodyColor: '#11062a',
  edgeColor: '#2d1658',
  windowColors: [NEON.cyan, NEON.pink, NEON.yellow, '#8f7bff', '#3a2a6e', '#3a2a6e'],
  windowChance: 0.25,
  windowWidth: 1,
  neonColors: NEON_COLORS,
  neonChance: 0.4,
  antennaChance: 0.3,
  parallax: 0.22,
}

const NEAR_SKYLINE: SkylineOptions = {
  seed: 37,
  minHeight: 18,
  maxHeight: 64,
  minWidth: 24,
  maxWidth: 52,
  minGap: 4,
  maxGap: 24,
  bodyColor: '#08020f',
  edgeColor: '#3a1050',
  windowColors: [NEON.pink, NEON.cyan, NEON.yellow, '#2a1a40'],
  windowChance: 0.12,
  windowWidth: 2,
  neonColors: NEON_COLORS,
  neonChance: 0.6,
  antennaChance: 0.15,
  parallax: 0.5,
}

export function createBackground(): Background {
  const sky = createSkyCanvas()
  const moon = createMoonCanvas()
  const farLayer = createSkylineLayer(FAR_SKYLINE)
  const midLayer = createSkylineLayer(MID_SKYLINE)
  const nearLayer = createSkylineLayer(NEAR_SKYLINE)
  const twinkleStars = createTwinkleStars()
  const carStyles = createHoverCarStyles()
  const hoverCars = Array.from({ length: HOVER_CAR_COUNT }, () =>
    createHoverCar(carStyles, MAX_VIEW_WIDTH, true),
  )
  let lightningTimer = randomRange(Math.random, 6, 14)
  let lightningAge = Number.POSITIVE_INFINITY
  let bolt: Point[] = []

  const update = (dt: number, worldSpeed: number, viewWidth: number) => {
    for (const car of hoverCars) {
      car.x += (car.speed - worldSpeed * HOVER_CAR_PARALLAX) * dt
      const isOffscreen = car.x < -HOVER_CAR_MARGIN || car.x > viewWidth + HOVER_CAR_MARGIN
      if (isOffscreen) Object.assign(car, createHoverCar(carStyles, viewWidth, false))
    }

    lightningAge += dt
    lightningTimer -= dt
    if (lightningTimer > 0) return
    lightningTimer = randomRange(Math.random, 10, 24)
    lightningAge = 0
    bolt = createBolt(viewWidth)
  }

  const render = (
    ctx: CanvasRenderingContext2D,
    viewWidth: number,
    scroll: number,
    time: number,
  ) => {
    ctx.drawImage(sky, 0, 0)
    renderTwinkleStars(ctx, twinkleStars, viewWidth, time)
    ctx.drawImage(moon, getMoonX(viewWidth), 8)
    renderLightning(ctx, viewWidth, lightningAge, bolt)
    renderSkylineLayer(ctx, farLayer, viewWidth, scroll, time)
    renderHaze(ctx, viewWidth, 96, '255, 43, 214', 0.16)
    renderSkylineLayer(ctx, midLayer, viewWidth, scroll, time)
    renderHoverCars(ctx, hoverCars)
    renderHaze(ctx, viewWidth, 150, '34, 229, 255', 0.06)
    renderSkylineLayer(ctx, nearLayer, viewWidth, scroll, time)
  }

  return { update, render }
}

function createSkyCanvas(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(MAX_VIEW_WIDTH, GROUND_Y)
  const palette = buildGradientPalette(SKY_STOPS, SKY_PALETTE_STEPS)
  const image = ctx.createImageData(MAX_VIEW_WIDTH, GROUND_Y)

  for (let y = 0; y < GROUND_Y; y++) {
    const position = (y / (GROUND_Y - 1)) * (palette.length - 1)
    const index = Math.floor(position)
    const fraction = position - index
    for (let x = 0; x < MAX_VIEW_WIDTH; x++) {
      const colorIndex = Math.min(index + (isDitherOn(x, y, fraction) ? 1 : 0), palette.length - 1)
      const color = palette[colorIndex]
      const offset = (y * MAX_VIEW_WIDTH + x) * 4
      image.data[offset] = color.r
      image.data[offset + 1] = color.g
      image.data[offset + 2] = color.b
      image.data[offset + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)

  const random = createRng(7)
  for (let i = 0; i < STATIC_STAR_COUNT; i++) {
    const brightness = random()
    ctx.fillStyle = brightness > 0.85 ? '#ffffff' : brightness > 0.5 ? '#b9a8ff' : '#6a55a8'
    ctx.fillRect(randomInt(random, 0, MAX_VIEW_WIDTH - 1), Math.floor(random() ** 1.6 * 140), 1, 1)
  }
  return canvas
}

function createMoonCanvas(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(MOON_SIZE, MOON_SIZE)
  const center = MOON_SIZE / 2

  for (let y = 0; y < MOON_SIZE; y++) {
    for (let x = 0; x < MOON_SIZE; x++) {
      const distance = Math.hypot(x - center, y - center)
      if (distance <= MOON_RADIUS) {
        const shade = (x - center + (y - center)) / MOON_RADIUS
        ctx.fillStyle = shade > 0.7 ? '#cdb6f0' : shade > 0.2 ? '#e6d8ff' : '#fbf5ff'
        ctx.fillRect(x, y, 1, 1)
        continue
      }
      if (distance > MOON_RADIUS + MOON_HALO) continue
      const level = (1 - (distance - MOON_RADIUS) / MOON_HALO) * 0.6
      if (!isDitherOn(x, y, level)) continue
      ctx.fillStyle = distance < MOON_RADIUS + 3 ? '#b04aa8' : '#5e1a6e'
      ctx.fillRect(x, y, 1, 1)
    }
  }

  fillPixelCircle(ctx, center - 4, center - 3, 2, '#d8c6f2')
  fillPixelCircle(ctx, center + 3, center + 2, 3, '#c4aee8')
  fillPixelCircle(ctx, center - 1, center + 6, 1, '#d8c6f2')
  return canvas
}

function createSkylineLayer(options: SkylineOptions): SkylineLayer {
  const { canvas, ctx } = createPixelCanvas(TILE_WIDTH, GROUND_Y)
  const random = createRng(options.seed)
  const lights: BlinkLight[] = []
  let x = 0

  while (x < TILE_WIDTH) {
    const width = randomInt(random, options.minWidth, options.maxWidth)
    const height = randomInt(random, options.minHeight, options.maxHeight)
    const building = createBuilding(random, width, height, options)
    const top = GROUND_Y - building.canvas.height
    ctx.drawImage(building.canvas, x, top)
    ctx.drawImage(building.canvas, x - TILE_WIDTH, top)
    for (const light of building.lights) {
      lights.push({ ...light, x: (x + light.x) % TILE_WIDTH, y: top + light.y })
    }
    x += width + randomInt(random, options.minGap, options.maxGap)
  }

  return { canvas, parallax: options.parallax, lights }
}

function createBuilding(
  random: Random,
  width: number,
  height: number,
  options: SkylineOptions,
): BuildingArt {
  const { canvas, ctx } = createPixelCanvas(width, height + ROOF_SPACE)
  const lights: BlinkLight[] = []
  let roofY = ROOF_SPACE

  ctx.fillStyle = options.bodyColor
  ctx.fillRect(0, roofY, width, height)
  if (width >= 18 && random() < 0.35) {
    const tierHeight = randomInt(random, 3, 7)
    ctx.fillRect(3, roofY - tierHeight, width - 6, tierHeight)
    roofY -= tierHeight
  }

  ctx.fillStyle = options.edgeColor
  ctx.fillRect(0, ROOF_SPACE, 1, height)

  const windowStep = options.windowWidth + 2
  for (let y = ROOF_SPACE + 3; y < ROOF_SPACE + height - 2; y += 4) {
    const floorChance = options.windowChance * randomRange(random, 0.2, 1.8)
    for (let x = 2; x + options.windowWidth <= width - 2; x += windowStep) {
      if (random() >= floorChance) continue
      ctx.fillStyle = pick(random, options.windowColors)
      ctx.fillRect(x, y, options.windowWidth, 2)
    }
  }

  if (height > 30 && random() < options.neonChance) {
    drawVerticalSign(ctx, random, width, height, options.neonColors)
  }

  if (random() < options.antennaChance) {
    const antennaX = randomInt(random, 4, width - 5)
    const antennaHeight = randomInt(random, 4, roofY - 2)
    ctx.fillStyle = options.edgeColor
    ctx.fillRect(antennaX, roofY - antennaHeight, 1, antennaHeight)
    lights.push({ x: antennaX, y: roofY - antennaHeight - 1, phase: random() * Math.PI * 2 })
  }

  return { canvas, lights }
}

function drawVerticalSign(
  ctx: CanvasRenderingContext2D,
  random: Random,
  width: number,
  height: number,
  colors: readonly string[],
): void {
  const signHeight = randomInt(random, 10, Math.min(28, height - 12))
  const signX = random() < 0.5 ? 2 : width - 5
  const signY = ROOF_SPACE + randomInt(random, 3, 8)
  ctx.fillStyle = pick(random, colors)
  ctx.globalAlpha = 0.3
  ctx.fillRect(signX - 1, signY - 1, 5, signHeight + 2)
  ctx.globalAlpha = 1
  for (let y = 0; y < signHeight; y++) {
    for (let x = 0; x < 3; x++) {
      if (random() < 0.55) ctx.fillRect(signX + x, signY + y, 1, 1)
    }
  }
}

function createTwinkleStars(): TwinkleStar[] {
  return Array.from({ length: TWINKLE_STAR_COUNT }, () => ({
    x: randomInt(Math.random, 0, MAX_VIEW_WIDTH - 1),
    y: randomInt(Math.random, 2, 110),
    phase: Math.random() * Math.PI * 2,
    speed: randomRange(Math.random, 1, 3),
  }))
}

function createHoverCarStyles(): HoverCarStyle[] {
  return [
    ['#2f2457', NEON.cyan],
    ['#4a1640', NEON.pink],
    ['#1f3a4a', NEON.yellow],
  ].map(([body, glow]) => {
    const right = createHoverCarSprite(body, glow)
    return { right, left: flipHorizontal(right) }
  })
}

function createHoverCar(styles: HoverCarStyle[], viewWidth: number, isInitial: boolean): HoverCar {
  const style = pick(Math.random, styles)
  const isFacingRight = Math.random() < 0.5
  const speed = isFacingRight
    ? randomRange(Math.random, 60, 100)
    : -randomRange(Math.random, 20, 60)
  const spawnX = isFacingRight ? -16 - Math.random() * 60 : viewWidth + 16 + Math.random() * 60
  return {
    x: isInitial ? Math.random() * viewWidth : spawnX,
    y: randomInt(Math.random, 36, 150),
    speed,
    sprite: isFacingRight ? style.right : style.left,
    isFacingRight,
  }
}

function createBolt(viewWidth: number): Point[] {
  const points: Point[] = []
  const length = randomInt(Math.random, 60, 110)
  let x = Math.round(randomRange(Math.random, viewWidth * 0.1, viewWidth * 0.9))
  let direction = Math.random() < 0.5 ? -1 : 1
  for (let y = 0; y < length; y++) {
    if (Math.random() < 0.12) direction = -direction
    if (Math.random() < 0.7) x += direction
    points.push({ x, y })
  }
  return points
}

function getLightningIntensity(age: number): number {
  if (age > 0.6) return 0
  if (age < 0.06) return 1
  if (age < 0.12) return 0.15
  if (age < 0.2) return 0.8
  return 0.8 * (1 - (age - 0.2) / 0.4)
}

function getMoonX(viewWidth: number): number {
  return viewWidth >= NARROW_VIEW_WIDTH ? viewWidth - MOON_SIZE - 16 : viewWidth - MOON_SIZE + 12
}

function getTileOffset(distance: number): number {
  return ((Math.floor(distance) % TILE_WIDTH) + TILE_WIDTH) % TILE_WIDTH
}

function renderTwinkleStars(
  ctx: CanvasRenderingContext2D,
  stars: TwinkleStar[],
  viewWidth: number,
  time: number,
): void {
  ctx.fillStyle = '#ffffff'
  for (const star of stars) {
    if (star.x >= viewWidth) continue
    const brightness = 0.5 + 0.5 * Math.sin(time * star.speed + star.phase)
    if (brightness < 0.3) continue
    ctx.globalAlpha = brightness
    ctx.fillRect(star.x, star.y, 1, 1)
    if (brightness < 0.85) continue
    ctx.globalAlpha = brightness * 0.4
    ctx.fillRect(star.x - 1, star.y, 3, 1)
    ctx.fillRect(star.x, star.y - 1, 1, 3)
  }
  ctx.globalAlpha = 1
}

function renderLightning(
  ctx: CanvasRenderingContext2D,
  viewWidth: number,
  age: number,
  bolt: Point[],
): void {
  const intensity = getLightningIntensity(age)
  if (intensity <= 0) return
  ctx.fillStyle = `rgba(190, 160, 255, ${intensity * 0.28})`
  ctx.fillRect(0, 0, viewWidth, GROUND_Y)
  if (age > 0.3) return
  ctx.globalAlpha = intensity
  ctx.fillStyle = '#f4ecff'
  for (const point of bolt) ctx.fillRect(point.x, point.y, 1, 1)
  ctx.globalAlpha = 1
}

function renderSkylineLayer(
  ctx: CanvasRenderingContext2D,
  layer: SkylineLayer,
  viewWidth: number,
  scroll: number,
  time: number,
): void {
  const offset = getTileOffset(scroll * layer.parallax)
  for (let x = -offset; x < viewWidth; x += TILE_WIDTH) ctx.drawImage(layer.canvas, x, 0)

  ctx.fillStyle = NEON.red
  for (const light of layer.lights) {
    if (Math.sin(time * 2.4 + light.phase) < 0.4) continue
    for (let x = light.x - offset; x < viewWidth; x += TILE_WIDTH) {
      if (x < 0) continue
      ctx.globalAlpha = 1
      ctx.fillRect(x, light.y, 1, 1)
      ctx.globalAlpha = 0.35
      ctx.fillRect(x - 1, light.y, 3, 1)
      ctx.fillRect(x, light.y - 1, 1, 3)
    }
  }
  ctx.globalAlpha = 1
}

function renderHaze(
  ctx: CanvasRenderingContext2D,
  viewWidth: number,
  startY: number,
  rgb: string,
  alpha: number,
): void {
  const gradient = ctx.createLinearGradient(0, startY, 0, GROUND_Y)
  gradient.addColorStop(0, `rgba(${rgb}, 0)`)
  gradient.addColorStop(1, `rgba(${rgb}, ${alpha})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, startY, viewWidth, GROUND_Y - startY)
}

function renderHoverCars(ctx: CanvasRenderingContext2D, cars: HoverCar[]): void {
  for (const car of cars) {
    const x = Math.round(car.x)
    const y = Math.round(car.y)
    const width = car.sprite.width

    ctx.fillStyle = '#ff2244'
    for (let i = 1; i <= 6; i++) {
      ctx.globalAlpha = 0.5 - i * 0.07
      ctx.fillRect(car.isFacingRight ? x - i : x + width - 1 + i, y + 2, 1, 1)
    }
    ctx.fillStyle = '#fff3b0'
    ctx.globalAlpha = 0.3
    ctx.fillRect(car.isFacingRight ? x + width : x - 4, y + 2, 4, 1)
    ctx.globalAlpha = 1
    ctx.drawImage(car.sprite, x, y)
  }
}
