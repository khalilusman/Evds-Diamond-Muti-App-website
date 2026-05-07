// @ts-ignore — dxf-parser has no bundled types
import DxfParser from 'dxf-parser'

export interface DxfPiece {
  id: number
  perimeter: number
}

export interface DxfParseResult {
  pieceCount: number
  pieces: DxfPiece[]
  totalPerimeter: number
  warnings: string[]
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function polylinePerimeter(verts: Array<{ x: number; y: number }>, closed: boolean): number {
  let sum = 0
  for (let i = 0; i < verts.length - 1; i++) {
    sum += dist(verts[i].x, verts[i].y, verts[i + 1].x, verts[i + 1].y)
  }
  if (closed && verts.length > 2) {
    sum += dist(
      verts[verts.length - 1].x,
      verts[verts.length - 1].y,
      verts[0].x,
      verts[0].y,
    )
  }
  return sum
}

function arcLength(radius: number, startAngle: number, endAngle: number): number {
  let sweep = endAngle - startAngle
  if (sweep <= 0) sweep += 360
  return radius * ((sweep * Math.PI) / 180)
}

// ─── LINE grouping (find closed loops via adjacency graph) ────────────────────

const TOLERANCE = 0.001

function pointKey(x: number, y: number): string {
  return `${Math.round(x / TOLERANCE) * TOLERANCE},${Math.round(y / TOLERANCE) * TOLERANCE}`
}

interface Segment {
  from: { x: number; y: number }
  to: { x: number; y: number }
  used: boolean
}

function findClosedLoopsFromLines(
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>,
): number[] {
  const segments: Segment[] = lines.map((l) => ({
    from: { x: l.x1, y: l.y1 },
    to: { x: l.x2, y: l.y2 },
    used: false,
  }))

  const adj = new Map<string, Segment[]>()
  for (const seg of segments) {
    const k1 = pointKey(seg.from.x, seg.from.y)
    const k2 = pointKey(seg.to.x, seg.to.y)
    if (!adj.has(k1)) adj.set(k1, [])
    if (!adj.has(k2)) adj.set(k2, [])
    adj.get(k1)!.push(seg)
    adj.get(k2)!.push({ from: seg.to, to: seg.from, used: seg.used })
  }

  const perimeters: number[] = []

  for (const seg of segments) {
    if (seg.used) continue
    const path: Array<{ x: number; y: number }> = [seg.from]
    let current = seg.to
    let totalLen = dist(seg.from.x, seg.from.y, seg.to.x, seg.to.y)
    seg.used = true

    let steps = 0
    while (steps++ < 10000) {
      const key = pointKey(current.x, current.y)
      const neighbors = adj.get(key) ?? []
      const next = neighbors.find((n) => !n.used && pointKey(n.to.x, n.to.y) !== pointKey(path[path.length - 1]?.x ?? -Infinity, path[path.length - 1]?.y ?? -Infinity))
      if (!next) break
      next.used = true
      totalLen += dist(current.x, current.y, next.to.x, next.to.y)
      path.push(current)
      current = next.to

      // Check if we're back at the start
      if (pointKey(current.x, current.y) === pointKey(path[0].x, path[0].y) && path.length >= 3) {
        perimeters.push(round2(totalLen))
        break
      }
    }
  }

  return perimeters
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function parseDxfFile(file: File): Promise<DxfParseResult> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 10MB.')
  }

  const text = await file.text()

  const parser = new DxfParser()
  let dxf: any
  try {
    dxf = parser.parseSync(text)
  } catch {
    throw new Error('Could not parse DXF file. Ensure it is a valid DXF format (R12 or later).')
  }

  const entities: any[] = dxf?.entities ?? []
  const pieces: DxfPiece[] = []
  const warnings: string[] = []
  let id = 1

  // ── LWPOLYLINE: each closed instance = one piece ──────────────────────────
  for (const e of entities) {
    if (e.type !== 'LWPOLYLINE') continue
    const closed = e.shape === true || e.closed === true
    if (!closed) continue
    const verts: Array<{ x: number; y: number }> = e.vertices ?? []
    if (verts.length < 3) continue
    const p = round2(polylinePerimeter(verts, true))
    if (p > 0) pieces.push({ id: id++, perimeter: p })
  }

  // ── POLYLINE (older 2D variant) ───────────────────────────────────────────
  for (const e of entities) {
    if (e.type !== 'POLYLINE') continue
    const closed = e.shape === true || e.closed === true || (e.flags & 1) === 1
    if (!closed) continue
    const verts: Array<{ x: number; y: number }> = e.vertices ?? []
    if (verts.length < 3) continue
    const p = round2(polylinePerimeter(verts, true))
    if (p > 0) pieces.push({ id: id++, perimeter: p })
  }

  // ── LINE entities: attempt to reconstruct closed loops ───────────────────
  const lines = entities
    .filter((e) => e.type === 'LINE')
    .map((e) => ({
      x1: e.vertices?.[0]?.x ?? 0,
      y1: e.vertices?.[0]?.y ?? 0,
      x2: e.vertices?.[1]?.x ?? 0,
      y2: e.vertices?.[1]?.y ?? 0,
    }))

  if (lines.length > 0) {
    const loopPerimeters = findClosedLoopsFromLines(lines)
    for (const p of loopPerimeters) {
      if (p > 0) pieces.push({ id: id++, perimeter: p })
    }
    if (loopPerimeters.length === 0 && pieces.length === 0) {
      warnings.push(`${lines.length} LINE entities found but could not form closed contours.`)
    }
  }

  // ── Standalone ARC entities ───────────────────────────────────────────────
  for (const e of entities) {
    if (e.type !== 'ARC') continue
    const r = Number(e.radius ?? 0)
    const start = Number(e.startAngle ?? 0)
    const end = Number(e.endAngle ?? 0)
    if (r <= 0) continue
    const sweep = end <= start ? end - start + 360 : end - start
    if (sweep >= 359) {
      // Full circle = one piece (circle contour)
      const p = round2(2 * Math.PI * r)
      pieces.push({ id: id++, perimeter: p })
    }
    // Partial arcs are ignored unless they are part of a LINE loop (handled above)
  }

  if (pieces.length === 0) {
    warnings.push(
      'No closed contours detected. Please check that your DXF contains closed LWPOLYLINE entities, or switch to Manual Input.',
    )
  }

  const totalPerimeter = round2(pieces.reduce((sum, p) => sum + p.perimeter, 0))

  return { pieceCount: pieces.length, pieces, totalPerimeter, warnings }
}
