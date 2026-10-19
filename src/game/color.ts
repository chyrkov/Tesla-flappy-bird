import { lerp } from './math'

export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function mixRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    r: Math.round(lerp(from.r, to.r, t)),
    g: Math.round(lerp(from.g, to.g, t)),
    b: Math.round(lerp(from.b, to.b, t)),
  }
}

export function buildGradientPalette(stops: readonly string[], steps: number): Rgb[] {
  const colors = stops.map(hexToRgb)
  const lastStop = colors.length - 1
  return Array.from({ length: steps }, (_, index) => {
    const position = (index / (steps - 1)) * lastStop
    const stopIndex = Math.floor(position)
    const nextIndex = Math.min(stopIndex + 1, lastStop)
    return mixRgb(colors[stopIndex], colors[nextIndex], position - stopIndex)
  })
}
