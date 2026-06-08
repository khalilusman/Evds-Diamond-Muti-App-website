import api from './client'

export interface DiscFamily {
  id: string
  name: string
  wear_rule_mm: number
  description?: string | null
}

export interface CatalogEntry {
  id: string
  family_id: string
  material_type: string
  nominal_diameter: number
  rpm: number
  diamond_height: number
  thickness_t1: number
  feed_t1: number
  life_t1: number
  thickness_t2: number
  feed_t2: number
  life_t2: number
  miter_feed: number
  family: { name: string }
}

export interface WearRef {
  id: string
  family_id: string
  nominal_diameter: number
  measured_new: number
  measured_worn: number
  family: { name: string }
}

export const getDiscFamilies = async (): Promise<DiscFamily[]> => {
  const { data } = await api.get('/api/disc-families')
  return data.data ?? []
}

export const createDiscFamily = async (payload: { name: string; wear_rule_mm: number; description?: string }): Promise<DiscFamily> => {
  const { data } = await api.post('/api/disc-families', payload)
  return data.data
}

export const updateDiscFamily = async (id: string, payload: Partial<Omit<DiscFamily, 'id'>>): Promise<DiscFamily> => {
  const { data } = await api.patch(`/api/disc-families/${id}`, payload)
  return data.data
}

export const getCatalog = async (familyId?: string): Promise<CatalogEntry[]> => {
  const params: Record<string, string> = {}
  if (familyId) params.family_id = familyId
  const { data } = await api.get('/api/disc-catalog', { params })
  return data.data ?? []
}

export const createCatalogEntry = async (payload: Omit<CatalogEntry, 'id' | 'family'>): Promise<CatalogEntry> => {
  const { data } = await api.post('/api/disc-catalog', payload)
  return data.data
}

export const updateCatalogEntry = async (id: string, payload: Partial<Omit<CatalogEntry, 'id' | 'family'>>): Promise<CatalogEntry> => {
  const { data } = await api.patch(`/api/disc-catalog/${id}`, payload)
  return data.data
}

export const deleteCatalogEntry = async (id: string): Promise<void> => {
  await api.delete(`/api/disc-catalog/${id}`)
}

export const getWearReference = async (): Promise<WearRef[]> => {
  const { data } = await api.get('/api/wear-reference')
  return data.data ?? []
}

export const updateWearReference = async (id: string, payload: { measured_new?: number; measured_worn?: number }): Promise<WearRef> => {
  const { data } = await api.patch(`/api/wear-reference/${id}`, payload)
  return data.data
}

export const createWearReference = async (payload: {
  family_id: string; nominal_diameter: number; measured_new: number; measured_worn: number
}): Promise<WearRef> => {
  const { data } = await api.post('/api/wear-reference', payload)
  return data.data
}

export const deleteDiscFamily = async (id: string): Promise<void> => {
  await api.delete(`/api/disc-families/${id}`)
}

export interface SatDiagnosisRule {
  id: string
  symptom_code: string
  symptom_label: string
  probable_cause: string
  recommended_fix: string
  prevention: string
  updated_at: string
}

export const getSatConfig = async (): Promise<SatDiagnosisRule[]> => {
  const { data } = await api.get('/api/sat-config')
  return data.data ?? []
}

export const updateSatRule = async (
  symptomCode: string,
  payload: { symptom_label?: string; probable_cause?: string; recommended_fix?: string; prevention?: string }
): Promise<SatDiagnosisRule> => {
  const { data } = await api.patch(`/api/sat-config/${symptomCode}`, payload)
  return data.data
}
