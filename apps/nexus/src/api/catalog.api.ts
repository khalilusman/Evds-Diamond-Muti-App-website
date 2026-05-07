import api from './client'

export interface DiscFamily {
  id: string
  name: string
  description?: string
}

export interface DiscCatalog {
  id: string
  family_id: string
  material_group: string
  nominal_diameter: number
  diamond_height: number
  recommended_rpm: number
  feed_2cm: number
  life_2cm: number
  feed_3cm: number
  life_3cm: number
  miter_feed: number
  family?: DiscFamily
}

export interface WearReference {
  id: string
  family_id: string
  nominal_diameter: number
  measured_new: number
  measured_worn: number
  family?: DiscFamily
}

export const getFamilies = async (): Promise<DiscFamily[]> => {
  const { data } = await api.get('/api/disc-families')
  return data.data
}

export const getCatalog = async (params?: {
  family_id?: string
  material_group?: string
  nominal_diameter?: number
}): Promise<DiscCatalog[]> => {
  const { data } = await api.get('/api/disc-catalog', { params })
  return data.data
}

export const getWearReference = async (params?: {
  family_id?: string
  nominal_diameter?: number
}): Promise<WearReference[]> => {
  const { data } = await api.get('/api/wear-reference', { params })
  return data.data
}

export const getMaterials = async (): Promise<string[]> => {
  const { data } = await api.get('/api/materials')
  return data.data
}
