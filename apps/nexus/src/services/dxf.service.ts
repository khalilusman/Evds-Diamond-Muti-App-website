/**
 * EVDS Diamond — DXF Parser Service
 * Parses raw DXF text directly — does NOT rely on dxf-parser npm package
 * for geometry extraction (it misreads LINE vertices in many DXF files).
 *
 * Algorithm:
 *   1. Extract all LINE and ARC entities from layer "0" by reading raw codes
 *   2. Build a graph of segments sharing endpoints (within SNAP tolerance)
 *   3. Walk closed loops from every unvisited segment
 *   4. Filter: keep loops with perimeter > MIN_PIECE_MM
 *   5. Nesting check: mark loops whose centroid lies strictly inside a larger
 *      loop as "holes" (internal cuts) — show but flag separately
 *   6. Return external pieces + all detected shapes for transparency
 */

export interface DxfPiece {
  id: number
  label: string
  perimeter_mm: number
  area_m2: number
  is_internal: boolean   // true = hole / internal cut
}

export interface DxfResult {
  pieces: DxfPiece[]           // external pieces only
  internal_cuts: DxfPiece[]    // holes / internal cutouts
  all_shapes: DxfPiece[]       // everything found
  total_perimeter_mm: number   // sum of external pieces
  total_perimeter_m: number
  total_area_m2: number
  piece_count: number
  warnings: string[]
}

// ─── tuneable constants ───────────────────────────────────────────────────────
const SNAP = 2.0          // mm — endpoint matching tolerance
const MIN_PIECE_MM = 200  // mm — ignore loops smaller than this (noise/arrows)
// ─────────────────────────────────────────────────────────────────────────────

interface Segment {
  type: 'LINE' | 'ARC'
  start: [number, number]
  end: [number, number]
  length: number
}

interface Loop {
  segments: number[]
  perimeter: number
  vertices: Array<[number, number]>
  bbox: { minx: number; maxx: number; miny: number; maxy: number }
  centroid: [number, number]
  area_m2: number
}

// ─── raw DXF entity extraction ────────────────────────────────────────────────

function extractEntities(dxfText: string): Segment[] {
  const lines = dxfText.split(/\r?\n/)
  const segments: Segment[] = []
  let i = 0

  while (i < lines.length) {
    const code = lines[i]?.trim()
    const val  = lines[i + 1]?.trim() ?? ''

    if (code === '0' && (val === 'LINE' || val === 'ARC')) {
      const etype = val as 'LINE' | 'ARC'
      let layer = ''
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0          // LINE
      let cx = 0, cy = 0, radius = 0, sa = 0, ea = 360  // ARC
      let j = i + 2

      while (j < Math.min(i + 60, lines.length)) {
        const c = lines[j]?.trim()
        const v = lines[j + 1]?.trim() ?? ''

        if (c === '8')  layer  = v
        if (c === '10') { try { if (etype === 'LINE') x1 = parseFloat(v); else cx = parseFloat(v) } catch {} }
        if (c === '20') { try { if (etype === 'LINE') y1 = parseFloat(v); else cy = parseFloat(v) } catch {} }
        if (c === '11') { try { x2 = parseFloat(v) } catch {} }
        if (c === '21') { try { y2 = parseFloat(v) } catch {} }
        if (c === '40') { try { radius = parseFloat(v) } catch {} }
        if (c === '50') { try { sa = parseFloat(v) } catch {} }
        if (c === '51') { try { ea = parseFloat(v) } catch {} }
        if (j > i + 2 && c === '0') break
        j += 2
      }

      if (layer === '0') {
        if (etype === 'LINE') {
          const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
          if (len > 0.5) {
            segments.push({ type: 'LINE', start: [x1, y1], end: [x2, y2], length: len })
          }
        } else {
          // ARC — always counterclockwise in DXF
          const sx = cx + radius * Math.cos((sa * Math.PI) / 180)
          const sy = cy + radius * Math.sin((sa * Math.PI) / 180)
          const ex = cx + radius * Math.cos((ea * Math.PI) / 180)
          const ey = cy + radius * Math.sin((ea * Math.PI) / 180)
          let sweep = ea - sa
          if (sweep <= 0) sweep += 360
          const arcLen = radius * (sweep * Math.PI) / 180
          if (arcLen > 0.5) {
            segments.push({ type: 'ARC', start: [sx, sy], end: [ex, ey], length: arcLen })
          }
        }
      }
    }
    i++
  }

  return segments
}

// ─── closed-loop walker ───────────────────────────────────────────────────────

function dist(a: [number, number], b: [number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
}

function findLoops(segments: Segment[]): Loop[] {
  const used = new Array<boolean>(segments.length).fill(false)
  const loops: Loop[] = []

  for (let si = 0; si < segments.length; si++) {
    if (used[si]) continue

    const chain: number[] = [si]
    used[si] = true
    let cur: [number, number] = segments[si].end
    const startPt: [number, number] = segments[si].start
    let closed = false

    for (let iter = 0; iter < 500; iter++) {
      if (dist(cur, startPt) < SNAP && chain.length > 2) {
        closed = true
        break
      }

      let found = false
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue
        const s = segments[j]
        if (dist(cur, s.start) < SNAP) {
          chain.push(j); used[j] = true; cur = s.end; found = true; break
        }
        if (dist(cur, s.end) < SNAP) {
          chain.push(j); used[j] = true; cur = s.start; found = true; break
        }
      }
      if (!found) break
    }

    if (!closed || chain.length < 3) continue

    const perimeter = chain.reduce((sum, idx) => sum + segments[idx].length, 0)
    if (perimeter < MIN_PIECE_MM) continue

    // Collect vertices for bounding box / centroid
    const verts: Array<[number, number]> = []
    for (const idx of chain) {
      verts.push(segments[idx].start)
      verts.push(segments[idx].end)
    }

    const xs = verts.map(v => v[0])
    const ys = verts.map(v => v[1])
    const minx = Math.min(...xs), maxx = Math.max(...xs)
    const miny = Math.min(...ys), maxy = Math.max(...ys)

    const centroid: [number, number] = [
      (minx + maxx) / 2,
      (miny + maxy) / 2,
    ]

    // Skip loops centred near the DXF origin — template frames sit at (0,0)
    if (Math.abs(centroid[0]) < 100 && Math.abs(centroid[1]) < 100) continue

    // Approximate area using bounding box (in m²)
    const area_m2 = ((maxx - minx) * (maxy - miny)) / 1_000_000

    loops.push({
      segments: chain,
      perimeter,
      vertices: verts,
      bbox: { minx, maxx, miny, maxy },
      centroid,
      area_m2,
    })
  }

  return loops
}

// ─── point-in-bbox check (fast nesting test) ──────────────────────────────────

function pointInBbox(
  pt: [number, number],
  bbox: { minx: number; maxx: number; miny: number; maxy: number },
  margin = 1.0,
): boolean {
  return (
    pt[0] > bbox.minx + margin &&
    pt[0] < bbox.maxx - margin &&
    pt[1] > bbox.miny + margin &&
    pt[1] < bbox.maxy - margin
  )
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function parseDxfFile(file: File): Promise<DxfResult> {
  const text = await file.text()
  const warnings: string[] = []

  // 1. Extract raw entities
  const segments = extractEntities(text)

  if (segments.length === 0) {
    return {
      pieces: [],
      internal_cuts: [],
      all_shapes: [],
      total_perimeter_mm: 0,
      total_perimeter_m: 0,
      total_area_m2: 0,
      piece_count: 0,
      warnings: ['No LINE or ARC entities found on layer 0. Check that your cutting paths are on layer 0.'],
    }
  }

  // 2. Find closed loops
  const loops = findLoops(segments)

  if (loops.length === 0) {
    warnings.push('No closed loops detected. Ensure all piece boundaries are fully closed.')
    return {
      pieces: [],
      internal_cuts: [],
      all_shapes: [],
      total_perimeter_mm: 0,
      total_perimeter_m: 0,
      total_area_m2: 0,
      piece_count: 0,
      warnings,
    }
  }

  // 3. Sort largest → smallest
  loops.sort((a, b) => b.perimeter - a.perimeter)

  // 4. Nesting: a loop is "internal" if its centroid lies inside a LARGER loop's bbox
  //    We use bbox containment as a fast approximation — sufficient for typical stone-cutting DXF files
  const isInternal = new Array<boolean>(loops.length).fill(false)
  for (let i = 0; i < loops.length; i++) {
    for (let j = 0; j < i; j++) {
      // j is larger (sorted descending)
      if (pointInBbox(loops[i].centroid, loops[j].bbox, SNAP * 2)) {
        isInternal[i] = true
        break
      }
    }
  }

  // 5. Build result objects
  const allShapes: DxfPiece[] = loops.map((loop, idx) => ({
    id: idx + 1,
    label: `Piece ${idx + 1}`,
    perimeter_mm: Math.round(loop.perimeter * 100) / 100,
    area_m2: Math.round(loop.area_m2 * 10000) / 10000,
    is_internal: isInternal[idx],
  }))

  const pieces        = allShapes.filter(p => !p.is_internal)
  const internal_cuts = allShapes.filter(p =>  p.is_internal)

  // Re-label external pieces as Piece 1, 2, 3 …
  pieces.forEach((p, i) => { p.label = `Piece ${i + 1}` })
  internal_cuts.forEach((p, i) => { p.label = `Internal cut ${i + 1}` })

  const total_perimeter_mm = pieces.reduce((s, p) => s + p.perimeter_mm, 0)
  const total_perimeter_m  = Math.round((total_perimeter_mm / 1000) * 1000) / 1000
  const total_area_m2      = Math.round(pieces.reduce((s, p) => s + p.area_m2, 0) * 10000) / 10000

  if (pieces.length === 0) {
    warnings.push('All detected shapes appear to be internal cuts. Check your DXF layer structure.')
  }

  return {
    pieces,
    internal_cuts,
    all_shapes: allShapes,
    total_perimeter_mm: Math.round(total_perimeter_mm * 100) / 100,
    total_perimeter_m,
    total_area_m2,
    piece_count: pieces.length,
    warnings,
  }
}
