import { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { prisma } from '../lib/prisma'
import { createAuditLog } from '../services/audit.service'
import { generateUniqueCodes, FAMILY_ABBREVIATIONS } from '../services/label.service'

const MM = 2.8346  // points per mm
const LABEL_W = 105 * MM
const LABEL_H = 70 * MM
const LOGO_PATH = path.join(process.cwd(), '..', '..', 'assets', 'evds-logo.png')
const LABEL_GAP = 2 * MM

const MATERIAL_DISPLAY: Record<string, string> = {
  quartzite_es:   'Quartzite (Cuarcita)',
  porcelain:      'Porcelain & Dekton',
  quartzite:      'Quartzite',
  granite:        'Granite',
  compact_quartz: 'Compact Quartz',
}

// POST /api/labels/generate
export async function generateLabels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { lot_number, family_id, nominal_diameter, quantity } = req.body

    if (!lot_number || !family_id || !nominal_diameter || !quantity) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'lot_number, family_id, nominal_diameter, quantity are required' })
      return
    }
    if (!/^[A-Z]?\d{8}$/.test(lot_number)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'lot_number must match format: optional letter + 8 digits (e.g. 20261231)' })
      return
    }

    const qty = Number(quantity)
    if (!qty || qty < 1 || qty > 10000) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'quantity must be between 1 and 10000' })
      return
    }

    const family = await prisma.discFamily.findUnique({ where: { id: family_id } })
    if (!family) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Disc family not found' })
      return
    }

    const abbrev = FAMILY_ABBREVIATIONS[family.name] ?? family.name.slice(0, 2).toUpperCase()
    const validDiameters = await prisma.discCatalog.findMany({
      where: { family_id },
      select: { nominal_diameter: true },
      distinct: ['nominal_diameter'],
    })
    const validDiaSet = new Set(validDiameters.map((d) => d.nominal_diameter))
    if (!validDiaSet.has(Number(nominal_diameter))) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Diameter ${nominal_diameter}mm is not valid for ${family.name}. Valid: ${Array.from(validDiaSet).sort().join(', ')}mm`,
      })
      return
    }

    const codes = await generateUniqueCodes(qty)
    const now = new Date()

    const labelsData = codes.map((code) => {
      const full_code = `${lot_number}-${abbrev}${nominal_diameter}-${code}`
      const qr_url = `https://nexus.evdsdiamond.com/activate?code=${code}`
      return {
        lot_number,
        family_id,
        nominal_diameter: Number(nominal_diameter),
        unique_code: code,
        full_code,
        qr_url,
        created_at: now,
      }
    })

    await prisma.discLabel.createMany({ data: labelsData })

    await createAuditLog({
      actorId: req.user!.userId,
      entityType: 'disc_labels',
      entityId: lot_number,
      action: 'LABEL_GENERATED',
      newValue: { lot_number, family: family.name, nominal_diameter, quantity: qty },
    })

    res.status(201).json({
      data: { lot_number, family: family.name, nominal_diameter: Number(nominal_diameter), quantity: qty, generated: codes.length },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/labels
export async function listLabels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (req.query.lot_number) where.lot_number = req.query.lot_number
    if (req.query.family_id) where.family_id = req.query.family_id
    if (req.query.status) where.status = req.query.status

    const [labels, total] = await prisma.$transaction([
      prisma.discLabel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { family: { select: { name: true } } },
      }),
      prisma.discLabel.count({ where }),
    ])

    res.json({ data: labels, total, page, limit })
  } catch (err) {
    next(err)
  }
}

// GET /api/labels/lots
export async function listLots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = await prisma.discLabel.groupBy({
      by: ['lot_number', 'family_id', 'nominal_diameter'],
      _count: { id: true },
    })

    const statusCounts = await prisma.discLabel.groupBy({
      by: ['lot_number', 'family_id', 'nominal_diameter', 'status'],
      _count: { id: true },
    })

    const statusMap: Record<string, Record<string, number>> = {}
    for (const s of statusCounts) {
      const key = `${s.lot_number}::${s.family_id}::${s.nominal_diameter}`
      if (!statusMap[key]) statusMap[key] = {}
      statusMap[key][s.status] = s._count.id
    }

    const familyIds = [...new Set(raw.map((r) => r.family_id))]
    const families = await prisma.discFamily.findMany({ where: { id: { in: familyIds } }, select: { id: true, name: true } })
    const familyMap = Object.fromEntries(families.map((f) => [f.id, f.name]))

    const lots = raw.map((r) => {
      const key = `${r.lot_number}::${r.family_id}::${r.nominal_diameter}`
      const sc = statusMap[key] ?? {}
      return {
        lot_number: r.lot_number,
        family_name: familyMap[r.family_id] ?? r.family_id,
        nominal_diameter: r.nominal_diameter,
        total: r._count.id,
        unused: sc['UNUSED'] ?? 0,
        active: sc['ACTIVE'] ?? 0,
        expired_w1: sc['EXPIRED_W1'] ?? 0,
        active_w2: sc['ACTIVE_W2'] ?? 0,
        permanently_deactivated: sc['PERMANENTLY_DEACTIVATED'] ?? 0,
        voided: sc['VOIDED'] ?? 0,
      }
    })

    res.json({ data: lots })
  } catch (err) {
    next(err)
  }
}

// GET /api/labels/lookup?code=A7K9P2
export async function lookupLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.query
    if (!code) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'code query param is required' })
      return
    }

    const label = await prisma.discLabel.findUnique({
      where: { unique_code: String(code).toUpperCase() },
      include: { family: true },
    })

    if (!label) {
      res.status(404).json({ error: 'CODE_NOT_FOUND', message: 'Activation code not found' })
      return
    }

    const statusErrors: Record<string, [number, string, string]> = {
      VOIDED: [403, 'CODE_VOIDED', 'This code has been voided'],
      ACTIVE: [409, 'ALREADY_ACTIVE', 'This code already has an active activation window'],
      ACTIVE_W2: [409, 'ALREADY_ACTIVE', 'This code already has an active activation window'],
      PERMANENTLY_DEACTIVATED: [410, 'MAX_ACTIVATIONS_REACHED', 'This code has reached its maximum activations'],
    }

    if (label.status in statusErrors) {
      const [status, error, message] = statusErrors[label.status]
      res.status(status).json({ error, message })
      return
    }

    const catalogOptions = await prisma.discCatalog.findMany({
      where: { family_id: label.family_id, nominal_diameter: label.nominal_diameter },
    })
    const wearRef = await prisma.wearReference.findUnique({
      where: { family_id_nominal_diameter: { family_id: label.family_id, nominal_diameter: label.nominal_diameter } },
    })

    res.json({
      data: {
        id: label.id,
        lot_number: label.lot_number,
        family: label.family,
        nominal_diameter: label.nominal_diameter,
        unique_code: label.unique_code,
        full_code: label.full_code,
        status: label.status,
        activation_count: label.activation_count,
        catalog_options: catalogOptions,
        wear_reference: wearRef,
      },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/labels/:id
export async function getLabelById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const label = await prisma.discLabel.findUnique({
      where: { id: String(req.params.id) },
      include: {
        family: true,
        activations: {
          orderBy: { activated_at: 'desc' },
          include: { company: { select: { id: true, name: true } } },
        },
        attempts: { orderBy: { created_at: 'desc' }, take: 20 },
      },
    })
    if (!label) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Label not found' })
      return
    }
    res.json({ data: label })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/labels/:id/void
export async function voidLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body
    if (!reason || String(reason).trim().length === 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Void reason is required' })
      return
    }

    const label = await prisma.discLabel.findUnique({ where: { id: String(req.params.id) } })
    if (!label) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Label not found' })
      return
    }
    if (label.status === 'ACTIVE' || label.status === 'ACTIVE_W2') {
      res.status(400).json({ error: 'CANNOT_VOID_ACTIVE', message: 'Cannot void a code with an active activation window' })
      return
    }

    const updated = await prisma.discLabel.update({
      where: { id: String(req.params.id) },
      data: { status: 'VOIDED', voided_at: new Date(), void_reason: reason },
    })

    await createAuditLog({
      actorId: req.user!.userId,
      entityType: 'disc_labels',
      entityId: label.id,
      action: 'CODE_VOIDED',
      oldValue: { status: label.status },
      newValue: { status: 'VOIDED', void_reason: reason },
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}

// ─── drawLabel helper ─────────────────────────────────────────────────────────

type PDFDoc = InstanceType<typeof PDFDocument>

async function drawLabel(
  doc:        PDFDoc,
  label:      { family: { name: string }; nominal_diameter: number; unique_code: string; full_code: string; qr_url: string; lot_number: string },
  lbX:        number,
  lbY:        number,
  materials:  string[],
  logoExists: boolean,
): Promise<void> {
  const accentW = Math.round(3 * MM)
  const padX    = Math.round(2 * MM)
  const padY    = Math.round(2 * MM)
  const lx      = lbX + accentW + padX
  const rx      = lbX + LABEL_W - padX
  const cw      = rx - lx

  // ── border + left accent bar ───────────────────────────────────────────────
  doc.lineWidth(0.5).rect(lbX, lbY, LABEL_W, LABEL_H).stroke('#d1d5db')
  doc.rect(lbX, lbY, accentW, LABEL_H).fill('#1e3a8a')

  let cy = lbY + padY

  // ── SECTION 1: header ─────────────────────────────────────────────────────
  if (logoExists) {
    doc.image(LOGO_PATH, lx, cy, { height: 12, fit: [65, 12] })
  } else {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e3a8a')
      .text('EVDS', lx, cy + 2, { lineBreak: false })
  }
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e3a8a')
    .text('DIAMOND TOOL ID', lx, cy + 2, { width: cw, align: 'right', lineBreak: false })
  cy += 16

  doc.lineWidth(0.5).moveTo(lx, cy).lineTo(rx, cy).stroke('#e5e7eb')
  cy += 3

  // ── SECTION 2: disc info (left) + QR (right) ──────────────────────────────
  const qrSize = 40
  const qrX    = rx - qrSize
  const txtW   = qrX - padX - lx
  const s2top  = cy

  try {
    const qrBuf = await QRCode.toBuffer(label.qr_url, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
    doc.image(qrBuf, qrX, s2top, { width: qrSize, height: qrSize })
  } catch {
    doc.lineWidth(0.5).rect(qrX, s2top, qrSize, qrSize).stroke('#d1d5db')
  }
  doc.font('Helvetica').fontSize(5.5).fillColor('#6b7280')
    .text('Scan for traceability', qrX, s2top + qrSize + 2, { width: qrSize, align: 'center', lineBreak: false })

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827')
    .text(label.family.name, lx, cy, { width: txtW, lineBreak: false })
  cy += 15

  doc.font('Helvetica').fontSize(8).fillColor('#374151')
    .text(`Diameter: ${label.nominal_diameter} mm`, lx, cy, { width: txtW, lineBreak: false })
  cy += 10

  if (materials.length > 0) {
    doc.font('Helvetica').fontSize(7).fillColor('#6b7280')
      .text(materials.join(' & '), lx, cy, { width: txtW, lineBreak: false })
    cy += 9
  }

  doc.font('Helvetica').fontSize(7).fillColor('#374151')
    .text(`Lot: ${label.lot_number}`, lx, cy, { width: txtW, lineBreak: false })
  cy += 9

  cy = Math.max(cy, s2top + qrSize + 14) + 5
  doc.lineWidth(0.5).moveTo(lx, cy).lineTo(rx, cy).stroke('#e5e7eb')
  cy += 3

  // ── SECTION 3: blue info box ───────────────────────────────────────────────
  const bxH   = 30
  const bxTop = cy
  doc.lineWidth(0.5).rect(lx, cy, cw, bxH).fillAndStroke('#eff6ff', '#bfdbfe')

  doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e3a8a')
    .text('UNLOCK YOUR CUTTING NUMBERS', lx + 4, bxTop + 4, { width: cw - 8, lineBreak: false })
  doc.font('Helvetica').fontSize(6).fillColor('#374151')
    .text('Register this blade in EVDS Nexus.', lx + 4, bxTop + 13, { width: cw - 90, lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#374151')
    .text('Track meters – speed – cost per meter', lx + 4, bxTop + 21, { width: cw - 90, lineBreak: false })
  doc.font('Helvetica-Oblique').fontSize(6).fillColor('#1e3a8a')
    .text('Make numbers work.', lx + 4, bxTop + 13, { width: cw - 8, align: 'right', lineBreak: false })
  cy += bxH + 4

  // ── SECTION 4: serial + LOT ────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#1e3a8a')
    .text('SERIAL', lx, cy, { lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#6b7280')
    .text('LOT', lx, cy, { width: cw, align: 'right', lineBreak: false })
  cy += 8

  const spaced = label.unique_code.split('').join(' ')
  doc.font('Courier-Bold').fontSize(13).fillColor('#1e3a8a')
    .text(spaced, lx, cy, { width: cw * 0.6, lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827')
    .text(label.lot_number, lx, cy + 2, { width: cw, align: 'right', lineBreak: false })
  cy += 18

  // ── SECTION 5: full reference box (anchored from bottom) ──────────────────
  const footerH = 12
  const refBoxH = 27
  const footerY = lbY + LABEL_H - padY - footerH
  const refBoxY = footerY - 3 - refBoxH

  doc.lineWidth(0.5).rect(lx, refBoxY, cw, refBoxH).fillAndStroke('#f3f4f6', '#d1d5db')
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#6b7280')
    .text('FULL REFERENCE', lx + 4, refBoxY + 4, { width: cw - 8, lineBreak: false })
  doc.font('Courier-Bold').fontSize(8).fillColor('#111827')
    .text(label.full_code, lx + 4, refBoxY + 13, { width: cw - 8, lineBreak: false })

  // ── footer ─────────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#9ca3af')
    .text('TRACK  –  VERIFY  –  CUT', lx, footerY + 1, { width: cw, align: 'center', lineBreak: false })
}

// GET /api/labels/export/pdf/:lot_number
export async function exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { lot_number } = req.params
    const where: Record<string, unknown> = { lot_number, status: 'UNUSED' }
    if (req.query.family_id) where.family_id = req.query.family_id
    if (req.query.nominal_diameter) where.nominal_diameter = Number(req.query.nominal_diameter)

    const labels = await prisma.discLabel.findMany({
      where,
      include: { family: true },
      orderBy: { created_at: 'asc' },
    })

    if (labels.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No UNUSED labels found for this lot' })
      return
    }

    // Pre-fetch materials once (same family+diameter for all labels in a lot)
    const first = labels[0]
    const catalogRows = await prisma.discCatalog.findMany({
      where: { family_id: first.family_id, nominal_diameter: first.nominal_diameter },
      select: { material_type: true },
      distinct: ['material_type'],
    })
    const materials = catalogRows.map((r) => MATERIAL_DISPLAY[r.material_type] ?? r.material_type)

    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="labels-${lot_number}.pdf"`)
    doc.pipe(res)

    const logoExists = fs.existsSync(LOGO_PATH)
    const COLS     = 2
    const ROWS     = 4
    const PER_PAGE = COLS * ROWS
    const marginTop = (841.89 - ROWS * LABEL_H - (ROWS - 1) * LABEL_GAP) / 2

    for (let i = 0; i < labels.length; i++) {
      const pos = i % PER_PAGE
      if (pos === 0 && i > 0) doc.addPage()
      const col = pos % COLS
      const row = Math.floor(pos / COLS)
      const x   = col * LABEL_W
      const y   = marginTop + row * (LABEL_H + LABEL_GAP)
      await drawLabel(doc, labels[i], x, y, materials, logoExists)
    }

    doc.end()
  } catch (err) {
    next(err)
  }
}

// GET /api/labels/export/csv/:lot_number
export async function exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const labels = await prisma.discLabel.findMany({
      where: { lot_number: String(req.params.lot_number) },
      include: { family: true },
      orderBy: { created_at: 'asc' },
    })

    if (labels.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No labels found for this lot' })
      return
    }

    const header = 'id,lot_number,family,diameter,unique_code,full_code,qr_url,status,created_at\n'
    const rows = labels.map((l) =>
      [l.id, l.lot_number, l.family.name, l.nominal_diameter, l.unique_code, l.full_code, l.qr_url, l.status, l.created_at.toISOString()].join(',')
    ).join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="labels-${req.params.lot_number}.csv"`)
    res.send(header + rows)
  } catch (err) {
    next(err)
  }
}

// GET /api/labels/security-alerts
export async function securityAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { result: { not: 'SUCCESS' } }
    if (req.query.result) where.result = req.query.result
    if (req.query.date_from || req.query.date_to) {
      const createdAt: Record<string, Date> = {}
      if (req.query.date_from) createdAt.gte = new Date(String(req.query.date_from))
      if (req.query.date_to) createdAt.lte = new Date(String(req.query.date_to))
      where.created_at = createdAt
    }

    const [attempts, total] = await prisma.$transaction([
      prisma.activationAttempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.activationAttempt.count({ where }),
    ])

    // Flag suspicious: same code attempted 3+ times in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentCounts = await prisma.activationAttempt.groupBy({
      by: ['unique_code'],
      where: { created_at: { gte: oneHourAgo }, result: { not: 'SUCCESS' } },
      _count: { unique_code: true },
      having: { unique_code: { _count: { gte: 3 } } },
    })
    const suspiciousCodes = new Set(recentCounts.map((r) => r.unique_code))

    const enriched = attempts.map((a) => ({ ...a, suspicious: suspiciousCodes.has(a.unique_code) }))

    res.json({ data: enriched, total, page, limit })
  } catch (err) {
    next(err)
  }
}
