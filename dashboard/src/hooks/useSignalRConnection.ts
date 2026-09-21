import { useEffect, useRef, useState } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr'
import { getApiUrl, getApiKey, type TelemetryUpdate } from '../lib/api'

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected'

export function useSignalRConnection(region: string | null) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [updates, setUpdates] = useState<Record<string, TelemetryUpdate>>({})
  const connectionRef = useRef<HubConnection | null>(null)

  useEffect(() => {
    const apiKey = getApiKey()
    const regions = region ? [region] : ['North', 'South', 'East', 'West']
    const connection = new HubConnectionBuilder()
      .withUrl(`${getApiUrl()}/hubs/fleet`, {
        accessTokenFactory: () => apiKey,
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('telemetryUpdated', (update: TelemetryUpdate) => {
      setUpdates((current) => ({ ...current, [update.vehicleExternalId]: update }))
    })
    connection.onreconnecting(() => setConnectionState('reconnecting'))
    connection.onreconnected(() => setConnectionState('connected'))
    connection.onclose(() => setConnectionState('disconnected'))
    connectionRef.current = connection

    void connection
      .start()
      .then(async () => {
        await Promise.all(regions.map((selectedRegion) => connection.invoke('SubscribeRegion', selectedRegion)))
        setConnectionState('connected')
      })
      .catch(() => setConnectionState('disconnected'))

    return () => {
      connectionRef.current = null
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop()
      }
    }
  }, [region])

  return { connectionState, updates }
}
