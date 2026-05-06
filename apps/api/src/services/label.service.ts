import crypto from 'crypto'
import { prisma } from '../lib/prisma'

// No O/0/I/1/L — ambiguous characters excluded
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const FAMILY_ABBREVIATIONS: Record<string, string> = {
  'THE QUEEN': 'TQ',
  'THE KING': 'TK',
  HERCULES: 'HC',
  'V-ARRAY': 'VA',
}

// Maps family name → allowed material_groups
export const FAMILY_VALID_MATERIALS: Record<string, string[]> = {
  'THE QUEEN': ['quartzite'],
  'THE KING': ['porcelain', 'quartzite'],
  HERCULES: ['porcelain'],
  'V-ARRAY': ['granite', 'compact_quartz'],
}

function randomCode(): string {
  // 32 chars in alphabet, 256 / 32 = 8 exactly → no modulo bias
  const bytes = crypto.randomBytes(6)
  let code = ''
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length]
  return code
}

export async function generateUniqueCodes(quantity: number): Promise<string[]> {
  const final = new Set<string>()
  let attempts = 0
  const MAX_ATTEMPTS = 10

  while (final.size < quantity) {
    if (attempts >= MAX_ATTEMPTS) throw new Error('Code generation failed after too many collision retries')
    attempts++

    const needed = quantity - final.size
    const candidates: string[] = []
    // generate 2x needed to reduce round-trips
    for (let i = 0; i < needed * 2; i++) candidates.push(randomCode())

    const existing = await prisma.discLabel.findMany({
      where: { unique_code: { in: candidates } },
      select: { unique_code: true },
    })
    const existingSet = new Set(existing.map((e) => e.unique_code))

    for (const code of candidates) {
      if (!existingSet.has(code) && !final.has(code)) {
        final.add(code)
        if (final.size >= quantity) break
      }
    }
  }

  return Array.from(final)
}
