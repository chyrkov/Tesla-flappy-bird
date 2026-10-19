import { GROUND_Y, MAX_VIEW_WIDTH, VIEW_HEIGHT } from './config'
import { randomInt, randomRange } from './math'

const DROP_COUNT = 140
const WRAP_WIDTH = MAX_VIEW_WIDTH + 40
const WIND = -36
const SPLASH_DURATION = 0.18

interface RainDrop {
  x: number
  y: number
  speed: number
  length: number
  isNear: boolean
  endY: number
}

interface Splash {
  x: number
  y: number
  age: number
}

export interface Rain {
  update: (dt: number, worldSpeed: number) => void
  render: (ctx: CanvasRenderingContext2D, viewWidth: number) => void
}

export function createRain(): Rain {
  const drops = Array.from({ length: DROP_COUNT }, () => createDrop(true))
  let splashes: Splash[] = []

  const update = (dt: number, worldSpeed: number) => {
    for (const drop of drops) {
      const drift = WIND - worldSpeed * (drop.isNear ? 0.6 : 0.2)
      drop.y += drop.speed * dt
      drop.x += drift * dt * (drop.isNear ? 1 : 0.6)
      if (drop.x < -8) drop.x += WRAP_WIDTH
      if (drop.y < drop.endY) continue
      if (drop.isNear) splashes.push({ x: Math.round(drop.x), y: Math.round(drop.endY), age: 0 })
      Object.assign(drop, createDrop(false))
    }

    for (const splash of splashes) splash.age += dt
    splashes = splashes.filter((splash) => splash.age < SPLASH_DURATION)
  }

  const render = (ctx: CanvasRenderingContext2D, viewWidth: number) => {
    for (const drop of drops) {
      if (drop.x > viewWidth + 2) continue
      const x = Math.round(drop.x)
      const y = Math.round(drop.y)
      const upperLength = Math.ceil(drop.length / 2)
      ctx.fillStyle = drop.isNear ? 'rgba(170, 210, 255, 0.55)' : 'rgba(140, 170, 255, 0.28)'
      ctx.fillRect(x, y, 1, upperLength)
      ctx.fillRect(x - 1, y + upperLength, 1, drop.length - upperLength)
    }

    ctx.fillStyle = 'rgba(170, 210, 255, 0.6)'
    for (const splash of splashes) {
      const isEarly = splash.age < SPLASH_DURATION / 2
      const spread = isEarly ? 1 : 2
      const y = isEarly ? splash.y - 1 : splash.y
      ctx.fillRect(splash.x - spread, y, 1, 1)
      ctx.fillRect(splash.x + spread, y, 1, 1)
    }
  }

  return { update, render }
}

function createDrop(isInitial: boolean): RainDrop {
  const isNear = Math.random() < 0.45
  return {
    x: Math.random() * WRAP_WIDTH,
    y: isInitial ? Math.random() * VIEW_HEIGHT : -randomRange(Math.random, 0, 40),
    speed: isNear ? randomRange(Math.random, 300, 380) : randomRange(Math.random, 180, 240),
    length: isNear ? randomInt(Math.random, 4, 6) : randomInt(Math.random, 2, 3),
    isNear,
    endY: isNear
      ? randomRange(Math.random, GROUND_Y + 2, VIEW_HEIGHT - 2)
      : randomRange(Math.random, 40, VIEW_HEIGHT),
  }
}
