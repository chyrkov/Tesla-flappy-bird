export const VIEW_HEIGHT = 256
export const MIN_VIEW_WIDTH = 144
export const MAX_VIEW_WIDTH = 576
export const GROUND_HEIGHT = 24
export const GROUND_Y = VIEW_HEIGHT - GROUND_HEIGHT

export const FIXED_STEP = 1 / 120
export const MAX_FRAME_TIME = 0.1

export const PHYSICS = {
  gravity: 900,
  flapVelocity: -265,
  maxFallSpeed: 420,
  ceilingY: 8,
} as const

export const DIFFICULTY = {
  startSpeed: 72,
  maxSpeed: 128,
  speedPerPoint: 1.6,
  startGap: 82,
  minGap: 60,
  gapShrinkPerPoint: 0.8,
  startSpacing: 128,
  minSpacing: 96,
  spacingShrinkPerPoint: 1,
  billboardsFromScore: 4,
  dronesFromScore: 10,
  gapMargin: 24,
  maxGapShift: 72,
} as const

export const TIMING = {
  deathToGameOver: 1.1,
  restartDelay: 0.5,
} as const

export const PLAYER_LAYOUT = {
  xRatio: 0.3,
  maxX: 112,
  readyYRatio: 0.42,
} as const

export const NEON = {
  pink: '#ff2bd6',
  cyan: '#22e5ff',
  yellow: '#ffd23f',
  purple: '#9b5cff',
  red: '#ff3355',
} as const
