import { createPixelCanvas } from './canvas'
import { GROUND_HEIGHT, GROUND_Y, NEON } from './config'
import { createRng, isDitherOn, pick, randomInt } from './math'

const TILE_WIDTH = 128
const ROAD_TOP = 8
const REFLECTION_COLORS = [NEON.pink, NEON.cyan, NEON.yellow, NEON.purple]

export interface Ground {
  render: (ctx: CanvasRenderingContext2D, viewWidth: number, scroll: number) => void
}

export function createGround(): Ground {
  const tile = createGroundTile()

  const render = (ctx: CanvasRenderingContext2D, viewWidth: number, scroll: number) => {
    const offset = Math.floor(scroll) % TILE_WIDTH
    for (let x = -offset; x < viewWidth; x += TILE_WIDTH) ctx.drawImage(tile, x, GROUND_Y)
  }

  return { render }
}

function createGroundTile(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TILE_WIDTH, GROUND_HEIGHT)
  const random = createRng(99)

  ctx.fillStyle = NEON.pink
  ctx.fillRect(0, 0, TILE_WIDTH, 1)
  ctx.fillStyle = '#7a1a6e'
  ctx.fillRect(0, 1, TILE_WIDTH, 1)
  ctx.fillStyle = '#22103d'
  ctx.fillRect(0, 2, TILE_WIDTH, 4)
  ctx.fillStyle = '#170a2c'
  for (let x = 0; x < TILE_WIDTH; x += 16) ctx.fillRect(x, 2, 1, 4)
  ctx.fillStyle = '#3d2470'
  ctx.fillRect(0, 6, TILE_WIDTH, 1)
  ctx.fillStyle = '#07030f'
  ctx.fillRect(0, 7, TILE_WIDTH, 1)
  ctx.fillStyle = '#0e0820'
  ctx.fillRect(0, ROAD_TOP, TILE_WIDTH, GROUND_HEIGHT - ROAD_TOP)

  for (let i = 0; i < 14; i++) {
    const reflectionX = randomInt(random, 0, TILE_WIDTH - 2)
    const length = randomInt(random, 4, 14)
    ctx.fillStyle = pick(random, REFLECTION_COLORS)
    for (let y = ROAD_TOP; y < Math.min(ROAD_TOP + length, GROUND_HEIGHT); y++) {
      const level = 0.5 * (1 - (y - ROAD_TOP) / length)
      for (let x = reflectionX; x < reflectionX + 2; x++) {
        if (isDitherOn(x, y, level)) ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  ctx.fillStyle = '#1a8aa0'
  for (let x = 0; x < TILE_WIDTH; x += 16) ctx.fillRect(x, 15, 8, 1)

  ctx.fillStyle = '#2a1e52'
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(
      randomInt(random, 0, TILE_WIDTH - 4),
      randomInt(random, 10, GROUND_HEIGHT - 2),
      3,
      1,
    )
  }

  return canvas
}
