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

// POST /api/disc-families
export async function createDiscFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, wear_rule_mm, description } = req.body
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'VALIDATION', message: 'name is required' }); return
    }
    if (wear_rule_mm === undefined || isNaN(Number(wear_rule_mm))) {
      res.status(400).json({ error: 'VALIDATION', message: 'wear_rule_mm is required' }); return
    }
    const family = await prisma.discFamily.create({
      data: { name: String(name).trim(), wear_rule_mm: Number(wear_rule_mm), description: description ?? null },
    })
    res.status(201).json({ data: family })
  } catch (err) { next(err) }
}

// PATCH /api/disc-families/:id
export async function updateDiscFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data: Record<string, unknown> = {}
    if (req.body.name !== undefined) data.name = String(req.body.name).trim()
    if (req.body.wear_rule_mm !== undefined) data.wear_rule_mm = Number(req.body.wear_rule_mm)
    if (req.body.description !== undefined) data.description = req.body.description
    const family = await prisma.discFamily.update({ where: { id: String(req.params.id) }, data })
    res.json({ data: family })
  } catch (err) { next(err) }
}

// POST /api/disc-catalog
export async function createCatalogEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { family_id, material_type, nominal_diameter, rpm, diamond_height,
            thickness_t1, feed_t1, life_t1, thickness_t2, feed_t2, life_t2, miter_feed } = req.body
    const entry = await prisma.discCatalog.create({
      data: {
        family_id: String(family_id),
        material_type: String(material_type),
        nominal_diameter: Number(nominal_diameter),
        rpm: Number(rpm),
        diamond_height: Number(diamond_height ?? 0),
        thickness_t1: Number(thickness_t1),
        feed_t1: Number(feed_t1),
        life_t1: Number(life_t1),
        thickness_t2: Number(thickness_t2),
        feed_t2: Number(feed_t2),
        life_t2: Number(life_t2),
        miter_feed: Number(miter_feed ?? 0),
      },
      include: { family: true },
    })
    res.status(201).json({ data: entry })
  } catch (err) { next(err) }
}

// PATCH /api/disc-catalog/:id
export async function updateCatalogEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const numFields = ['nominal_diameter', 'rpm', 'diamond_height', 'thickness_t1', 'feed_t1',
                       'life_t1', 'thickness_t2', 'feed_t2', 'life_t2', 'miter_feed']
    const data: Record<string, unknown> = {}
    if (req.body.material_type !== undefined) data.material_type = String(req.body.material_type)
    for (const f of numFields) {
      if (req.body[f] !== undefined) data[f] = Number(req.body[f])
    }
    const entry = await prisma.discCatalog.update({
      where: { id: String(req.params.id) }, data, include: { family: true },
    })
    res.json({ data: entry })
  } catch (err) { next(err) }
}

// DELETE /api/disc-catalog/:id
export async function deleteCatalogEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await prisma.discCatalog.delete({ where: { id: String(req.params.id) } })
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}

// PATCH /api/wear-reference/:id
export async function updateWearReference(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data: Record<string, unknown> = {}
    if (req.body.measured_new !== undefined) data.measured_new = Number(req.body.measured_new)
    if (req.body.measured_worn !== undefined) data.measured_worn = Number(req.body.measured_worn)
    const ref = await prisma.wearReference.update({
      where: { id: String(req.params.id) }, data, include: { family: true },
    })
    res.json({ data: ref })
  } catch (err) { next(err) }
}

// POST /api/wear-reference
export async function createWearReference(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { family_id, nominal_diameter, measured_new, measured_worn } = req.body
    const ref = await prisma.wearReference.create({
      data: {
        family_id: String(family_id),
        nominal_diameter: Number(nominal_diameter),
        measured_new: Number(measured_new),
        measured_worn: Number(measured_worn),
      },
      include: { family: true },
    })
    res.status(201).json({ data: ref })
  } catch (err) { next(err) }
}

// DELETE /api/disc-families/:id
export async function deleteDiscFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id)

    const labelCount = await prisma.discLabel.count({ where: { family_id: id } })
    if (labelCount > 0) {
      res.status(400).json({
        error: 'HAS_LABELS',
        message: 'Cannot delete family with existing disc labels. Void all labels first.',
      })
      return
    }

    await prisma.discCatalog.deleteMany({ where: { family_id: id } })
    await prisma.wearReference.deleteMany({ where: { family_id: id } })
    await prisma.discFamily.delete({ where: { id } })

    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
}
