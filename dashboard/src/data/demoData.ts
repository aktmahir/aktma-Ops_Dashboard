import type { FleetSummaryResponse, VehicleStatusResponse } from '../lib/api'

export const demoSummary: FleetSummaryResponse = {
  totalVehicles: 64,
  activeVehicles: 58,
  openAlerts: 7,
  averageSpeedKph: 47.8,
  generatedAt: new Date().toISOString(),
}

const regions = ['North', 'South', 'East', 'West'] as const

export const demoVehicles: VehicleStatusResponse[] = Array.from({ length: 24 }, (_, index) => {
  const number = index + 1
  const status = index === 3 || index === 17 ? 'Idle' : index === 9 ? 'Maintenance' : 'Moving'
  const fuelPercent = index === 6 || index === 14 ? 12 : 42 + ((index * 13) % 55)
  const temperature = index === 3 || index === 20 ? 108 : 78 + ((index * 3) % 17)
  return {
    vehicleId: `demo-${number}`,
    externalId: `VH-${String(number).padStart(3, '0')}`,
    name: `Vehicle ${String(number).padStart(3, '0')}`,
    region: regions[index % regions.length],
    status,
    observedAt: new Date(Date.now() - index * 42_000).toISOString(),
    latitude: 40.7128 + index * 0.012,
    longitude: -74.006 + index * 0.01,
    speedKph: status === 'Moving' ? 24 + ((index * 7) % 59) : 0,
    fuelPercent,
    engineTemperatureCelsius: temperature,
  }
})

export const demoSpeedSeries = Array.from({ length: 12 }, (_, index) => ({
  time: `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`,
  speed: 40 + Math.sin(index / 1.7) * 9 + (index % 3) * 3,
}))

export const demoAlerts = [
  { vehicle: 'VH-021', message: 'Engine temperature above threshold', severity: 'critical', time: '2 min ago' },
  { vehicle: 'VH-007', message: 'Fuel level below 15%', severity: 'warning', time: '6 min ago' },
  { vehicle: 'VH-014', message: 'Fuel level below 15%', severity: 'warning', time: '11 min ago' },
  { vehicle: 'VH-003', message: 'Unexpected idle state', severity: 'info', time: '18 min ago' },
] as const
