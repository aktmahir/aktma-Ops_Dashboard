import { useEffect, useRef, useState } from 'react'
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr'
import { getApiUrl, type TelemetryUpdate } from '../lib/api'

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected'

export function useSignalRConnection(region: string | null) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [updates, setUpdates] = useState<Record<string, TelemetryUpdate>>({})
  const connectionRef = useRef<HubConnection | null>(null)

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(`${getApiUrl()}/hubs/fleet`)
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
      .then(() => setConnectionState('connected'))
      .catch(() => setConnectionState('disconnected'))

    return () => {
      connectionRef.current = null
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop()
      }
    }
  }, [])

  useEffect(() => {
    const connection = connectionRef.current
    if (!connection || connection.state !== HubConnectionState.Connected || !region) {
      return
    }

    void connection.invoke('SubscribeRegion', region).catch(() => setConnectionState('disconnected'))
  }, [connectionState, region])

  return { connectionState, updates }
}
