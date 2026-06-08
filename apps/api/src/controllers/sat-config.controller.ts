import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

// GET /api/sat-config
export async function listRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rules = await prisma.satDiagnosisRule.findMany({ orderBy: { symptom_code: 'asc' } })
    res.json({ data: rules })
  } catch (err) { next(err) }
}

// PATCH /api/sat-config/:symptom_code — upsert
export async function upsertRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const symptom_code = String(req.params.symptom_code)
    const { symptom_label, probable_cause, recommended_fix, prevention } = req.body

    const update: Record<string, unknown> = {}
    if (symptom_label   !== undefined) update.symptom_label   = String(symptom_label)
    if (probable_cause  !== undefined) update.probable_cause  = String(probable_cause)
    if (recommended_fix !== undefined) update.recommended_fix = String(recommended_fix)
    if (prevention      !== undefined) update.prevention      = String(prevention)

    const rule = await prisma.satDiagnosisRule.upsert({
      where: { symptom_code },
      create: {
        symptom_code,
        symptom_label:   String(symptom_label   ?? symptom_code),
        probable_cause:  String(probable_cause  ?? ''),
        recommended_fix: String(recommended_fix ?? ''),
        prevention:      String(prevention      ?? ''),
      },
      update,
    })
    res.json({ data: rule })
  } catch (err) { next(err) }
}
