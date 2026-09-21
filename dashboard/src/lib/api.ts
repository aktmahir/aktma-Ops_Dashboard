export type VehicleStatus = 'Offline' | 'Idle' | 'Moving' | 'Maintenance'
export type AlertSeverity = 'Warning' | 'Critical'

export interface VehicleStatusResponse {
  vehicleId: string
  externalId: string
  name: string
  region: string
  status: VehicleStatus
  observedAt: string | null
  latitude: number | null
  longitude: number | null
  speedKph: number | null
  fuelPercent: number | null
  engineTemperatureCelsius: number | null
}

export interface FleetSummaryResponse {
  totalVehicles: number
  activeVehicles: number
  openAlerts: number
  averageSpeedKph: number
  generatedAt: string
}

export interface TelemetryUpdate {
  vehicleExternalId: string
  region: string
  observedAt: string
  latitude: number
  longitude: number
  speedKph: number
  fuelPercent: number
  engineTemperatureCelsius: number
}

export interface FleetAlertResponse {
  id: string
  vehicleExternalId: string
  code: string
  message: string
  severity: AlertSeverity
  triggeredAt: string
  resolvedAt: string | null
}

export interface VehicleDetailResponse {
  currentStatus: VehicleStatusResponse
  history: Array<{
    observedAt: string
    latitude: number
    longitude: number
    speedKph: number
    fuelPercent: number
    engineTemperatureCelsius: number
  }>
  alerts: FleetAlertResponse[]
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'
const apiKey = import.meta.env.VITE_API_KEY ?? ''

export function getApiKey(): string {
  return apiKey
}

async function getJson<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  const response = await fetch(`${apiUrl}${path}`, { headers })
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getFleetStatus(): Promise<VehicleStatusResponse[]> {
  return getJson<VehicleStatusResponse[]>('/api/fleet/status')
}

export function getFleetSummary(): Promise<FleetSummaryResponse> {
  return getJson<FleetSummaryResponse>('/api/fleet/summary')
}

export function getRecentAlerts(): Promise<FleetAlertResponse[]> {
  return getJson<FleetAlertResponse[]>('/api/alerts?limit=20')
}

export function getVehicleDetail(externalId: string): Promise<VehicleDetailResponse> {
  return getJson<VehicleDetailResponse>(`/api/fleet/${encodeURIComponent(externalId)}`)
}

export function getApiUrl(): string {
  return apiUrl
}
