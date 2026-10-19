import { createPixelCanvas } from './canvas'

type Palette = Readonly<Record<string, string>>

const ROADSTER_ROWS = [
  '..........SWWWWWWWS...............',
  '........SWGGGGGgggWWS.............',
  '......SWWGGGGGGGgggGWWWS..........',
  '...SWWWWWWWWWWWWWWWWWWWWWWWWS.....',
  '.RWWHHHHHHHHHHHHHHHHHHHHHHHHWWWWS.',
  'RRWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWL',
  'RWWSDDDDDSWWWWWWWWWWWWWSDDDDDSWWWS',
  '.SSDKKKKKDSSSSSSSSSSSSSDKKKKKDSSS.',
  '.DDKKMMMKKDDDDDDDDDDDDDKKMMMKKDD..',
  '...KMMmMMK.............KMMmMMK....',
  '...KMmmmMK.............KMmmmMK....',
  '...KKMMMKK.............KKMMMKK....',
  '....KKKKK...............KKKKK.....',
]

const ROADSTER_PALETTE: Palette = {
  W: '#eef0f5',
  H: '#ffffff',
  S: '#b4b9c6',
  D: '#2a2c34',
  G: '#14151c',
  g: '#3a4256',
  R: '#ff2a3a',
  L: '#e8f6ff',
  K: '#1a1b20',
  M: '#9a9ea8',
  m: '#5c606a',
}

const WRECK_PALETTE: Palette = {
  W: '#4a4a52',
  H: '#5c5c64',
  S: '#33333a',
  D: '#141418',
  G: '#0a0a0e',
  g: '#1c1e26',
  R: '#3a1a1e',
  L: '#4a4c50',
  K: '#08080a',
  M: '#3a3a40',
  m: '#24242a',
}

const HOVER_CAR_ROWS = ['...GGG...', '.BBBBBBB.', 'TBBBBBBBL', '..UUUUU..']

const DRONE_ROWS = ['.MM......MM.', '..MDDDDDDM..', '...DGGGGD...', '...DGRRGD...', '....DDDD....']

const DRONE_PALETTE: Palette = {
  M: '#6a6a8a',
  D: '#241a3a',
  G: '#4a4466',
  R: '#ff3355',
}

export const ROADSTER_WIDTH = Math.max(...ROADSTER_ROWS.map((row) => row.length))
export const ROADSTER_HEIGHT = ROADSTER_ROWS.length
export const DRONE_SPRITE_HEIGHT = DRONE_ROWS.length

export function createSprite(rows: readonly string[], palette: Palette): HTMLCanvasElement {
  const width = Math.max(...rows.map((row) => row.length))
  const { canvas, ctx } = createPixelCanvas(width, rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
  })
  return canvas
}

export function createRoadsterSprite(): HTMLCanvasElement {
  return createSprite(ROADSTER_ROWS, ROADSTER_PALETTE)
}

export function createRoadsterWreckSprite(): HTMLCanvasElement {
  return createSprite(ROADSTER_ROWS, WRECK_PALETTE)
}

export function createHoverCarSprite(bodyColor: string, glowColor: string): HTMLCanvasElement {
  return createSprite(HOVER_CAR_ROWS, {
    B: bodyColor,
    G: '#5ff2ff',
    T: '#ff2244',
    L: '#fff3b0',
    U: glowColor,
  })
}

export function createDroneSprite(): HTMLCanvasElement {
  return createSprite(DRONE_ROWS, DRONE_PALETTE)
}
