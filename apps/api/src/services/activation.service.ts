import cron from 'node-cron'
import { prisma } from '../lib/prisma'

async function expireActivations(): Promise<void> {
  const now = new Date()
  console.log(`[CRON] ${now.toISOString()} — checking for expired activations...`)

  try {
    // Find all activations that have passed their expiry and are still ACTIVE
    const expired = await prisma.discActivation.findMany({
      where: { expires_at: { lt: now }, status: 'ACTIVE' },
      include: { label: true },
    })

    if (expired.length === 0) {
      console.log('[CRON] No expired activations found.')
      return
    }

    let processed = 0
    for (const activation of expired) {
      const label = activation.label

      // Determine new label status based on activation count
      const newLabelStatus = label.activation_count >= 2 ? 'PERMANENTLY_DEACTIVATED' : 'EXPIRED_W1'

      await prisma.$transaction([
        prisma.discActivation.update({
          where: { id: activation.id },
          data: { status: 'EXPIRED', expired_at: now },
        }),
        prisma.discLabel.update({
          where: { id: label.id },
          data: { status: newLabelStatus },
        }),
      ])

      processed++
    }

    console.log(`[CRON] Expired ${processed} activation(s). Done.`)
  } catch (err) {
    console.error('[CRON ERROR]', (err as Error).message)
  }
}

export function startActivationCron(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', expireActivations)
  console.log('[CRON] Activation expiry job scheduled — runs every hour.')
}
