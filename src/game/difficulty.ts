import { DIFFICULTY } from './config'

export function getSpeed(score: number): number {
  return Math.min(DIFFICULTY.startSpeed + score * DIFFICULTY.speedPerPoint, DIFFICULTY.maxSpeed)
}

export function getGapSize(score: number): number {
  return Math.max(DIFFICULTY.startGap - score * DIFFICULTY.gapShrinkPerPoint, DIFFICULTY.minGap)
}

export function getSpacing(score: number): number {
  return Math.max(
    DIFFICULTY.startSpacing - score * DIFFICULTY.spacingShrinkPerPoint,
    DIFFICULTY.minSpacing,
  )
}
