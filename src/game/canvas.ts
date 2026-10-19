export interface PixelCanvas {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

export function createPixelCanvas(width: number, height: number): PixelCanvas {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is not supported')
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

export function flipHorizontal(source: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(source.width, source.height)
  ctx.translate(source.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(source, 0, 0)
  return canvas
}

export function flipVertical(source: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(source.width, source.height)
  ctx.translate(0, source.height)
  ctx.scale(1, -1)
  ctx.drawImage(source, 0, 0)
  return canvas
}

export function fillPixelCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color
  for (let y = -radius; y <= radius; y++) {
    const halfWidth = Math.floor(Math.sqrt(radius * radius + radius * 0.8 - y * y))
    ctx.fillRect(centerX - halfWidth, centerY + y, halfWidth * 2 + 1, 1)
  }
}
