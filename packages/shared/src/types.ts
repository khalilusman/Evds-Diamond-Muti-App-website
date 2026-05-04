import type { UserRole, DiscStatus, TicketStatus, TicketPriority } from './enums'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AuthPayload {
  userId: string
  email: string
  role: UserRole
  companyId: string | null
}

export interface DiscLabelDto {
  id: string
  uniqueCode: string
  fullCode: string
  qrUrl: string
  status: DiscStatus
  lotNumber: string
  familyName: string
  diameterMm: number
  material: string
  createdAt: string
}

export interface ActivationDto {
  id: string
  labelId: string
  uniqueCode: string
  status: DiscStatus
  diameterAtActivation: number
  activationCount: number
  window1StartsAt: string
  window1ExpiresAt: string
  window2StartsAt: string | null
  window2ExpiresAt: string | null
  companyId: string
}

export interface UsageLogDto {
  id: string
  activationId: string
  machineId: string
  machineName: string
  currentDiameter: number
  materialCut: string
  thicknessCm: number
  notes: string | null
  loggedAt: string
}

export interface WearStatus {
  currentDiameter: number
  newDiameter: number
  wornDiameter: number
  wearPercent: number
  level: 'ok' | 'warning' | 'critical'
}

export interface SatTicketDto {
  id: string
  subject: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  createdAt: string
  updatedAt: string
}
