import nodemailer from 'nodemailer'

const FROM = process.env.SMTP_FROM ?? 'EVDS Diamond <noreply@evdsdiamond.com>'
const INTERNAL = process.env.EVDS_INTERNAL_EMAIL ?? 'admin@evdsdiamond.com'
const NEXUS_URL = process.env.FRONTEND_NEXUS_URL ?? 'http://localhost:5173'
const DASHBOARD_URL = process.env.FRONTEND_DASHBOARD_URL ?? 'http://localhost:5174'

function isSmtpConfigured(): boolean {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env
  return !!(
    SMTP_HOST &&
    SMTP_USER &&
    SMTP_PASS &&
    SMTP_USER !== 'placeholder@gmail.com' &&
    SMTP_PASS !== 'placeholder'
  )
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!isSmtpConfigured()) {
    console.log(`\n[EMAIL — dev fallback]`)
    console.log(`  To:      ${to}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Body:    ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}`)
    console.log()
    return
  }
  try {
    const transporter = createTransport()
    await transporter.sendMail({ from: FROM, to, subject, html })
  } catch (err) {
    console.error('[EMAIL ERROR]', (err as Error).message)
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function sendRegistrationConfirm(to: string, companyName: string): Promise<void> {
  await send(
    to,
    'Registration received — EVDS Nexus',
    `<p>Hello,</p>
     <p>Thank you for registering <strong>${companyName}</strong> on EVDS Nexus.</p>
     <p>Your account is currently <strong>pending approval</strong> by our team.
     You will receive a confirmation email once your account has been reviewed.</p>
     <p>If you have any questions, please contact us at ${INTERNAL}.</p>
     <p>The EVDS Nexus Team</p>`
  )
}

export async function sendEvdsNewCompanyNotification(
  companyName: string,
  contactName: string,
  country: string,
  email: string
): Promise<void> {
  await send(
    INTERNAL,
    `New company registered: ${companyName}`,
    `<p>A new company has registered and is pending approval.</p>
     <table>
       <tr><td><strong>Company:</strong></td><td>${companyName}</td></tr>
       <tr><td><strong>Contact:</strong></td><td>${contactName}</td></tr>
       <tr><td><strong>Country:</strong></td><td>${country}</td></tr>
       <tr><td><strong>Email:</strong></td><td>${email}</td></tr>
     </table>
     <p><a href="${DASHBOARD_URL}/companies">Review in Dashboard →</a></p>`
  )
}

export async function sendAccountApproved(to: string, companyName: string): Promise<void> {
  await send(
    to,
    'Account approved — EVDS Nexus',
    `<p>Hello,</p>
     <p>Great news! Your account for <strong>${companyName}</strong> has been approved.</p>
     <p>You can now log in and start using EVDS Nexus:</p>
     <p><a href="${NEXUS_URL}/login">Log in to EVDS Nexus →</a></p>
     <p>The EVDS Nexus Team</p>`
  )
}

export async function sendAccountSuspended(
  to: string,
  companyName: string,
  reason: string
): Promise<void> {
  await send(
    to,
    'Account suspended — EVDS Nexus',
    `<p>Hello,</p>
     <p>Your account for <strong>${companyName}</strong> has been <strong>suspended</strong>.</p>
     <p><strong>Reason:</strong> ${reason}</p>
     <p>Please contact us at ${INTERNAL} to resolve this.</p>
     <p>The EVDS Nexus Team</p>`
  )
}

export async function sendAccountDeactivated(
  to: string,
  companyName: string,
  reason: string
): Promise<void> {
  await send(
    to,
    'Account deactivated — EVDS Nexus',
    `<p>Hello,</p>
     <p>Your account for <strong>${companyName}</strong> has been <strong>deactivated</strong>.</p>
     <p><strong>Reason:</strong> ${reason}</p>
     <p>If you believe this is a mistake, please contact us at ${INTERNAL}.</p>
     <p>The EVDS Nexus Team</p>`
  )
}

export async function sendPasswordReset(to: string, resetLink: string): Promise<void> {
  await send(
    to,
    'Reset your password — EVDS Nexus',
    `<p>Hello,</p>
     <p>You requested a password reset for your EVDS Nexus account.</p>
     <p><a href="${resetLink}">Reset your password →</a></p>
     <p>This link expires in <strong>1 hour</strong>. If you did not request this,
     please ignore this email — your password will not change.</p>
     <p>The EVDS Nexus Team</p>`
  )
}

export async function sendSatTicketResolved(
  to: string,
  ticketId: string,
  solution: string
): Promise<void> {
  await send(
    to,
    'Support ticket resolved — EVDS Nexus',
    `<p>Hello,</p>
     <p>Your support ticket <strong>#${ticketId.slice(0, 8).toUpperCase()}</strong> has been resolved.</p>
     <p><strong>EVDS Solution:</strong></p>
     <p>${solution}</p>
     <p>If you have further questions, please open a new ticket in EVDS Nexus.</p>
     <p>The EVDS Nexus Team</p>`
  )
}
