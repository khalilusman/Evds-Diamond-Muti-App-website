import { Request, Response, NextFunction } from 'express'
import { CompanyStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { createAuditLog } from '../services/audit.service'
import {
  sendAccountApproved,
  sendAccountSuspended,
  sendAccountDeactivated,
} from '../services/email.service'

// GET /api/companies  (EVDS staff)
export async function listCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (req.query.status) where.status = req.query.status
    if (req.query.country) where.country = req.query.country
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search as string, mode: 'insensitive' } },
        { email: { contains: req.query.search as string, mode: 'insensitive' } },
        { contact_name: { contains: req.query.search as string, mode: 'insensitive' } },
      ]
    }

    const [companies, total] = await prisma.$transaction([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { users: true, machines: true, activations: { where: { status: 'ACTIVE' } } } },
        },
      }),
      prisma.company.count({ where }),
    ])

    res.json({ data: companies, total, page, limit })
  } catch (err) {
    next(err)
  }
}

// GET /api/companies/me  (customer)
export async function getMyCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.companyId) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No company associated with this account' })
      return
    }

    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
      include: {
        machines: { where: { is_active: true }, orderBy: { name: 'asc' } },
        _count: { select: { activations: { where: { status: 'ACTIVE' } } } },
      },
    })

    if (!company) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Company not found' })
      return
    }

    res.json({ data: company })
  } catch (err) {
    next(err)
  }
}

// GET /api/companies/:id  (EVDS staff)
export async function getCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        machines: { where: { is_active: true } },
        _count: { select: { activations: { where: { status: 'ACTIVE' } } } },
      },
    })

    if (!company) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Company not found' })
      return
    }

    const statusHistory = await prisma.auditLog.findMany({
      where: { entity_type: 'companies', entity_id: company.id, action: 'COMPANY_STATUS_CHANGED' },
      orderBy: { created_at: 'desc' },
      take: 20,
    })

    const lastActivity = await prisma.usageLog.findFirst({
      where: { company_id: company.id },
      orderBy: { logged_at: 'desc' },
      select: { logged_at: true },
    })

    res.json({ data: { ...company, statusHistory, lastActivity: lastActivity?.logged_at ?? null } })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/companies/:id/status  (EVDS_ADMIN)
export async function updateCompanyStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, reason } = req.body
    const validStatuses: CompanyStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `Status must be one of: ${validStatuses.join(', ')}` })
      return
    }
    if ((status === 'SUSPENDED' || status === 'DEACTIVATED') && !reason) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A reason is required when suspending or deactivating an account' })
      return
    }

    const company = await prisma.company.findUnique({ where: { id: req.params.id } })
    if (!company) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Company not found' })
      return
    }

    const updated = await prisma.company.update({
      where: { id: req.params.id },
      data: { status, status_reason: reason ?? null },
    })

    await createAuditLog({
      actorId: req.user!.userId,
      entityType: 'companies',
      entityId: company.id,
      action: 'COMPANY_STATUS_CHANGED',
      oldValue: { status: company.status, status_reason: company.status_reason },
      newValue: { status, status_reason: reason ?? null },
    })

    // email notification — fire and forget
    const adminUser = await prisma.user.findFirst({
      where: { company_id: company.id, role: 'CUSTOMER_ADMIN' },
      select: { email: true },
    })
    if (adminUser) {
      if (status === 'ACTIVE') sendAccountApproved(adminUser.email, company.name).catch(() => null)
      if (status === 'SUSPENDED') sendAccountSuspended(adminUser.email, company.name, reason).catch(() => null)
      if (status === 'DEACTIVATED') sendAccountDeactivated(adminUser.email, company.name, reason).catch(() => null)
    }

    res.json({ data: updated, message: `Company status updated to ${status}` })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/companies/me  (CUSTOMER_ADMIN)
export async function updateMyCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.companyId) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No company associated with this account' })
      return
    }

    const body = req.body
    const allowed: Record<string, unknown> = {
      name: body.name,
      contact_name: body.contact_name,
      language: body.language,
      onboarding_complete: body.onboarding_complete,
    }
    Object.keys(allowed).forEach((k) => { if (allowed[k] === undefined) delete allowed[k] })

    const updated = await prisma.company.update({
      where: { id: req.user.companyId },
      data: allowed,
    })

    res.json({ data: updated })
  } catch (err) {
    next(err)
  }
}
