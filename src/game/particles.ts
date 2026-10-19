import { GROUND_Y } from './config'
import { randomRange } from './math'

const MAX_PARTICLES = 700

const FLAME_RAMP = ['#ffffff', '#fff3b0', '#ffd23f', '#ff8a1f', '#ff2b4a', '#7a1030']
const PLASMA_RAMP = ['#ffffff', '#a8f7ff', '#22e5ff', '#2a7bff', '#3a1a8a']
const SPARK_RAMP = ['#ffffff', '#ff9cf0', '#ff2bd6', '#9b5cff']
const SMOKE_RAMP = ['#4a3a66', '#3a2c55', '#2a1f40', '#1c1430']
const DEBRIS_RAMP = ['#ffffff', '#d8dbe4', '#9a9ea8', '#5c606a']
const JET_RAMP = ['#ffffff', '#e0f6ff', '#a8dcff', '#5fa8ff', '#2a4a9a']
const THRUSTER_SMOKE_RAMP = ['#ffffff', '#f0f2f8', '#dde1ec', '#c4cad9', '#a8b0c4']

export interface ParticleOptions {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  gravity: number
  drag: number
  ramp: readonly string[]
  isAdditive: boolean
  isFading?: boolean
}

interface Particle extends ParticleOptions {
  maxLife: number
}

interface BurstOptions {
  count: number
  x: number
  y: number
  direction: number
  spread: number
  minSpeed: number
  maxSpeed: number
  minLife: number
  maxLife: number
  sizes: readonly number[]
  gravity: number
  drag: number
  ramp: readonly string[]
  isAdditive: boolean
}

export interface ParticleSystem {
  emit: (options: ParticleOptions) => void
  update: (dt: number) => void
  render: (ctx: CanvasRenderingContext2D) => void
  clear: () => void
}

export function createParticleSystem(): ParticleSystem {
  let particles: Particle[] = []

  const emit = (options: ParticleOptions) => {
    if (particles.length >= MAX_PARTICLES) particles.shift()
    particles.push({ ...options, maxLife: options.life })
  }

  const update = (dt: number) => {
    for (const particle of particles) {
      const dragFactor = Math.exp(-particle.drag * dt)
      particle.vx *= dragFactor
      particle.vy = particle.vy * dragFactor + particle.gravity * dt
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.life -= dt
      if (particle.gravity > 0 && particle.y > GROUND_Y) {
        particle.y = GROUND_Y
        particle.vy *= -0.3
        particle.vx *= 0.6
      }
    }
    particles = particles.filter((particle) => particle.life > 0)
  }

  const render = (ctx: CanvasRenderingContext2D) => {
    for (const isAdditive of [false, true]) {
      ctx.globalCompositeOperation = isAdditive ? 'lighter' : 'source-over'
      for (const particle of particles) {
        if (particle.isAdditive !== isAdditive) continue
        const progress = 1 - particle.life / particle.maxLife
        const rampIndex = Math.min(
          particle.ramp.length - 1,
          Math.floor(progress * particle.ramp.length),
        )
        const half = Math.floor(particle.size / 2)
        ctx.globalAlpha = particle.isFading ? (particle.life / particle.maxLife) * 0.55 : 1
        ctx.fillStyle = particle.ramp[rampIndex]
        ctx.fillRect(
          Math.round(particle.x) - half,
          Math.round(particle.y) - half,
          particle.size,
          particle.size,
        )
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  const clear = () => {
    particles = []
  }

  return { emit, update, render, clear }
}

function emitBurst(system: ParticleSystem, options: BurstOptions): void {
  for (let i = 0; i < options.count; i++) {
    const angle = options.direction + randomRange(Math.random, -options.spread, options.spread)
    const speed = randomRange(Math.random, options.minSpeed, options.maxSpeed)
    system.emit({
      x: options.x,
      y: options.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(Math.random, options.minLife, options.maxLife),
      size: options.sizes[Math.floor(Math.random() * options.sizes.length)],
      gravity: options.gravity,
      drag: options.drag,
      ramp: options.ramp,
      isAdditive: options.isAdditive,
    })
  }
}

export function emitJetBurst(
  system: ParticleSystem,
  x: number,
  y: number,
  angle: number,
  strength: number,
): void {
  emitBurst(system, {
    count: Math.max(1, Math.round(4 * strength)),
    x,
    y,
    direction: angle + Math.PI / 2,
    spread: 0.12,
    minSpeed: 80 * strength,
    maxSpeed: 160 * strength,
    minLife: 0.12,
    maxLife: 0.28,
    sizes: [1],
    gravity: 0,
    drag: 3,
    ramp: JET_RAMP,
    isAdditive: true,
  })
}

export function emitThrusterSmoke(system: ParticleSystem, x: number, y: number): void {
  system.emit({
    x: x + randomRange(Math.random, -2, 2),
    y: y + randomRange(Math.random, 4, 10),
    vx: randomRange(Math.random, -60, -20),
    vy: randomRange(Math.random, 10, 40),
    life: randomRange(Math.random, 0.6, 1.2),
    size: Math.random() < 0.5 ? 3 : 4,
    gravity: -20,
    drag: 2.5,
    ramp: THRUSTER_SMOKE_RAMP,
    isAdditive: false,
    isFading: true,
  })
}

export function emitScoreSparks(system: ParticleSystem, x: number, y: number): void {
  emitBurst(system, {
    count: 10,
    x,
    y,
    direction: 0,
    spread: Math.PI,
    minSpeed: 30,
    maxSpeed: 80,
    minLife: 0.25,
    maxLife: 0.45,
    sizes: [1],
    gravity: 0,
    drag: 3,
    ramp: SPARK_RAMP,
    isAdditive: true,
  })
}

export function emitSmoke(system: ParticleSystem, x: number, y: number): void {
  system.emit({
    x: x + randomRange(Math.random, -4, 4),
    y,
    vx: randomRange(Math.random, -8, 8),
    vy: randomRange(Math.random, -36, -18),
    life: randomRange(Math.random, 0.9, 1.6),
    size: Math.random() < 0.5 ? 2 : 3,
    gravity: 0,
    drag: 0.5,
    ramp: SMOKE_RAMP,
    isAdditive: false,
    isFading: true,
  })
}

export function emitExplosion(system: ParticleSystem, x: number, y: number): void {
  const shared = { x, y, direction: 0, spread: Math.PI }
  emitBurst(system, {
    ...shared,
    count: 36,
    minSpeed: 30,
    maxSpeed: 170,
    minLife: 0.3,
    maxLife: 0.8,
    sizes: [1, 2, 3],
    gravity: 0,
    drag: 3,
    ramp: FLAME_RAMP,
    isAdditive: true,
  })
  emitBurst(system, {
    ...shared,
    count: 18,
    direction: -Math.PI / 2,
    spread: 1.4,
    minSpeed: 60,
    maxSpeed: 170,
    minLife: 0.9,
    maxLife: 1.6,
    sizes: [1, 2],
    gravity: 420,
    drag: 0.4,
    ramp: DEBRIS_RAMP,
    isAdditive: false,
  })
  emitBurst(system, {
    ...shared,
    count: 14,
    minSpeed: 80,
    maxSpeed: 220,
    minLife: 0.2,
    maxLife: 0.5,
    sizes: [1],
    gravity: 0,
    drag: 2,
    ramp: PLASMA_RAMP,
    isAdditive: true,
  })
  emitBurst(system, {
    ...shared,
    count: 10,
    minSpeed: 10,
    maxSpeed: 40,
    minLife: 0.8,
    maxLife: 1.4,
    sizes: [3],
    gravity: 0,
    drag: 1,
    ramp: SMOKE_RAMP,
    isAdditive: false,
  })
}
