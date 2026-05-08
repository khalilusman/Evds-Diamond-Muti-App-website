import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

// POST /api/machines
export async function createMachine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Machine name is required' })
      return
    }
    if (name.trim().length > 200) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Machine name must be 200 characters or less' })
      return
    }

    const machine = await prisma.machine.create({
      data: { name: name.trim(), company_id: req.user!.companyId! },
    })

    res.status(201).json({ data: machine })
  } catch (err) {
    next(err)
  }
}

// GET /api/machines
export async function listMachines(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const machines = await prisma.machine.findMany({
      where: { company_id: req.user!.companyId!, is_active: true },
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { activations: { where: { status: 'ACTIVE' } } },
        },
      },
    })

    const result = machines.map((m) => ({ ...m, active_disc_count: m._count.activations }))

    res.json({ data: result, total: result.length })
  } catch (err) {
    next(err)
  }
}

// GET /api/machines/:id/activations
export async function listMachineActivations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } })
    if (!machine || machine.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Machine not found in your company' })
      return
    }

    const activations = await prisma.discActivation.findMany({
      where: { machine_id: req.params.id, status: 'ACTIVE' },
      orderBy: { activated_at: 'desc' },
      include: {
        label: { include: { family: true } },
      },
    })

    res.json({ data: activations })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/machines/:id
export async function updateMachine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } })
    if (!machine || machine.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Machine not found in your company' })
      return
    }

    const { name } = req.body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Machine name is required' })
      return
    }

    const updated = await prisma.machine.update({
      where: { id: req.params.id },
      data: { name: name.trim() },
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/machines/:id  (soft delete)
export async function deleteMachine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } })
    if (!machine || machine.company_id !== req.user!.companyId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Machine not found in your company' })
      return
    }

    const activeCount = await prisma.discActivation.count({
      where: { machine_id: req.params.id, status: 'ACTIVE' },
    })
    if (activeCount > 0) {
      res.status(400).json({
        error: 'HAS_ACTIVE_ACTIVATIONS',
        message: 'Cannot delete machine with active disc activations',
      })
      return
    }

    await prisma.machine.update({ where: { id: req.params.id }, data: { is_active: false } })

    res.json({ message: 'Machine deactivated' })
  } catch (err) {
    next(err)
  }
}
