import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

const MATERIALS = {
  quartzite_es: {
    label: 'Quartzite (Cuarcita)',
    subtypes: ['Cuarcita española', 'Other'],
    compatible_families: ['THE QUEEN'],
    thickness_options: [2.0, 3.0],
  },
  porcelain: {
    label: 'Porcelain / Dekton',
    subtypes: ['Standard Porcelain', 'Large Format', 'Dekton', 'Neolith', 'Other'],
    compatible_families: ['THE KING', 'HERCULES'],
    thickness_options: [2.0, 1.2],
  },
  quartzite: {
    label: 'Quartzite (International)',
    subtypes: ['White Quartzite', 'Taj Mahal', 'Sea Pearl', 'Other'],
    compatible_families: ['THE KING'],
    thickness_options: [2.0, 3.0],
  },
  granite: {
    label: 'Granite',
    subtypes: ['Brazilian Black', 'Indian Black', 'African Red', 'White', 'Other'],
    compatible_families: ['V-ARRAY'],
    thickness_options: [2.0, 3.0],
  },
  compact_quartz: {
    label: 'Compact Quartz',
    subtypes: ['Silestone', 'Caesarstone', 'Compac', 'Other'],
    compatible_families: ['V-ARRAY'],
    thickness_options: [2.0, 3.0],
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
    if (req.query.material_type) where.material_type = req.query.material_type
    if (req.query.nominal_diameter) where.nominal_diameter = Number(req.query.nominal_diameter)

    const entries = await prisma.discCatalog.findMany({
      where,
      include: { family: true },
      orderBy: [{ family: { name: 'asc' } }, { material_type: 'asc' }, { nominal_diameter: 'asc' }],
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
      where: { id: String(req.params.id) },
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
