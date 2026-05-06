import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

const MATERIALS: Record<string, { label: string; subtypes: string[] }> = {
  granite: {
    label: 'Granite',
    subtypes: ['Brazilian Black', 'Indian Black', 'African Red', 'White Granite', 'Other Granite'],
  },
  compact_quartz: {
    label: 'Compact Quartz / Engineered Quartz',
    subtypes: ['Silestone', 'Caesarstone', 'Compac', 'Dekton Quartz', 'Other Compact Quartz'],
  },
  porcelain: {
    label: 'Porcelain / Dekton',
    subtypes: ['Standard Porcelain', 'Large Format Porcelain', 'Dekton', 'Neolith', 'Other Porcelain'],
  },
  quartzite: {
    label: 'Quartzite / Cuarcita',
    subtypes: ['White Quartzite', 'Taj Mahal', 'Sea Pearl', 'Calacatta Quartzite', 'Other Quartzite'],
  },
}

// GET /api/disc-families
export async function getDiscFamilies(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const families = await prisma.discFamily.findMany({ orderBy: { name: 'asc' } })
    res.json({ data: families })
  } catch (err) {
    next(err)
  }
}

// GET /api/disc-catalog
export async function getCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: Record<string, unknown> = {}
    if (req.query.family_id) where.family_id = req.query.family_id
    if (req.query.material_group) where.material_group = req.query.material_group
    if (req.query.nominal_diameter) where.nominal_diameter = Number(req.query.nominal_diameter)

    const entries = await prisma.discCatalog.findMany({
      where,
      include: { family: true },
      orderBy: [{ family: { name: 'asc' } }, { material_group: 'asc' }, { nominal_diameter: 'asc' }],
    })
    res.json({ data: entries })
  } catch (err) {
    next(err)
  }
}

// GET /api/disc-catalog/:id
export async function getCatalogEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await prisma.discCatalog.findUnique({
      where: { id: req.params.id },
      include: { family: true },
    })
    if (!entry) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Catalog entry not found' })
      return
    }
    res.json({ data: entry })
  } catch (err) {
    next(err)
  }
}

// GET /api/wear-reference
export async function getWearReference(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: Record<string, unknown> = {}
    if (req.query.family_id) where.family_id = req.query.family_id
    if (req.query.nominal_diameter) where.nominal_diameter = Number(req.query.nominal_diameter)

    const refs = await prisma.wearReference.findMany({
      where,
      include: { family: true },
      orderBy: [{ family: { name: 'asc' } }, { nominal_diameter: 'asc' }],
    })
    res.json({ data: refs })
  } catch (err) {
    next(err)
  }
}

// GET /api/materials
export function getMaterials(_req: Request, res: Response): void {
  res.json({ data: MATERIALS })
}
