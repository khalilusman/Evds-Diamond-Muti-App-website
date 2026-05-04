export enum UserRole {
  CUSTOMER_USER = 'CUSTOMER_USER',
  CUSTOMER_ADMIN = 'CUSTOMER_ADMIN',
  EVDS_SUPPORT = 'EVDS_SUPPORT',
  EVDS_ADMIN = 'EVDS_ADMIN',
}

export enum DiscStatus {
  unused = 'unused',
  active = 'active',
  expired_w1 = 'expired_w1',
  active_w2 = 'active_w2',
  permanently_deactivated = 'permanently_deactivated',
  voided = 'voided',
}

export enum TicketStatus {
  open = 'open',
  in_progress = 'in_progress',
  resolved = 'resolved',
  closed = 'closed',
}

export enum TicketPriority {
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical',
}

export const SUPPORTED_LANGUAGES = ['en', 'es', 'de', 'fr', 'pt', 'it', 'ar'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

export const BLADE_MATERIALS = {
  THE_QUEEN: ['Quartzite'],
  THE_KING: ['Porcelain', 'Quartzite'],
  HERCULES: ['Porcelain'],
  V_ARRAY: ['Granite', 'Compact Quartz'],
} as const
