import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, Bell, ChevronRight, CircleDot, Fuel, Gauge, MapPin, Radio, Search, ShieldAlert, Thermometer, Truck, Wifi, WifiOff, X } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { demoAlerts, demoSpeedSeries, demoSummary, demoVehicles } from './data/demoData'
import { useSignalRConnection } from './hooks/useSignalRConnection'
import { getFleetStatus, getFleetSummary, getRecentAlerts, getVehicleDetail, type FleetAlertResponse, type FleetSummaryResponse, type VehicleDetailResponse, type VehicleStatusResponse } from './lib/api'
import './App.css'

const statusMeta = {
  Moving: { label: 'Moving', className: 'healthy' },
  Idle: { label: 'Idle', className: 'warning' },
  Maintenance: { label: 'Service', className: 'critical' },
  Offline: { label: 'Offline', className: 'muted' },
} as const

function App() {
  const [summary, setSummary] = useState<FleetSummaryResponse | null>(null)
  const [vehicles, setVehicles] = useState<VehicleStatusResponse[]>([])
  const [alerts, setAlerts] = useState<FleetAlertResponse[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleStatusResponse | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<VehicleDetailResponse | null>(null)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const { connectionState, updates } = useSignalRConnection('North')

  useEffect(() => {
    let active = true
    void Promise.all([getFleetSummary(), getFleetStatus(), getRecentAlerts()])
      .then(([nextSummary, nextVehicles, nextAlerts]) => {
        if (!active) return
        setSummary(nextSummary)
        setVehicles(nextVehicles)
        setAlerts(nextAlerts)
      })
      .catch(() => {
        if (!active) return
        setSummary(demoSummary)
        setVehicles(demoVehicles)
        setAlerts(demoAlerts.map((alert, index) => ({ id: `demo-${index}`, vehicleExternalId: alert.vehicle, code: alert.message.toLowerCase().replaceAll(' ', '-'), message: alert.message, severity: alert.severity === 'critical' ? 'Critical' as const : 'Warning' as const, triggeredAt: new Date(Date.now() - (index + 1) * 120_000).toISOString(), resolvedAt: null })))
        setIsDemo(true)
      })
      .finally(() => active && setIsLoading(false))
    return () => { active = false }
  }, [])

  const liveVehicles = useMemo(() => vehicles.map((vehicle) => {
    const update = updates[vehicle.externalId]
    if (!update) return vehicle
    return { ...vehicle, ...update, status: update.speedKph > 1 ? 'Moving' as const : 'Idle' as const }
  }), [updates, vehicles])
  const filteredVehicles = liveVehicles.filter((vehicle) => `${vehicle.externalId} ${vehicle.name} ${vehicle.region}`.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    if (!selectedVehicle) {
      return
    }
    let active = true
    void getVehicleDetail(selectedVehicle.externalId)
      .then((detail) => active && setSelectedDetail(detail))
      .catch(() => active && setSelectedDetail(null))
    return () => { active = false }
  }, [selectedVehicle])

  return (
    <main className="app-shell">
      <Header connectionState={connectionState} />
      <div className="workspace">
        <Sidebar />
        <section className="content">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> COMMAND CENTER</div><h1>Fleet overview</h1><p>Operational awareness across your connected fleet.</p></div>
            <div className="heading-meta"><span className="refresh-label"><span className="live-pulse" /> Last sync 12:42:08 UTC</span><button className="icon-button" aria-label="Search"><Search size={17} /></button><button className="icon-button notification-button" aria-label="Notifications"><Bell size={17} /><span /></button></div>
          </div>
          {isDemo && <div className="demo-banner"><CircleDot size={14} /> Showing a recent snapshot while the API is unavailable.</div>}
          <div className="metric-grid">
            <MetricCard label="Total vehicles" value={summary?.totalVehicles ?? '--'} note="Across 4 regions" icon={<Truck size={17} />} tone="teal" loading={isLoading} />
            <MetricCard label="Active vehicles" value={summary?.activeVehicles ?? '--'} note={summary ? `${Math.round((summary.activeVehicles / summary.totalVehicles) * 100)}% of fleet` : 'Awaiting data'} icon={<Gauge size={17} />} tone="green" loading={isLoading} />
            <MetricCard label="Open alerts" value={summary?.openAlerts ?? '--'} note="2 critical · 5 warning" icon={<ShieldAlert size={17} />} tone="red" loading={isLoading} />
            <MetricCard label="Average speed" value={summary ? `${summary.averageSpeedKph}` : '--'} unit="km/h" note="Last 5 minutes" icon={<Activity size={17} />} tone="amber" loading={isLoading} />
          </div>
          <div className="primary-grid"><SpeedChart /><AlertsPanel alerts={alerts} /></div>
          <section className="panel fleet-panel">
            <div className="panel-heading fleet-heading"><div><span className="panel-kicker">FLEET STATUS</span><h2>Vehicle network <span className="heading-count">{filteredVehicles.length} visible</span></h2></div><div className="fleet-tools"><div className="search-field"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle or region" /></div><button className="filter-button">All statuses <ChevronRight size={13} /></button></div></div>
            {isLoading ? <div className="empty-state"><div className="loading-orbit" /><p>Loading fleet telemetry...</p></div> : filteredVehicles.length === 0 ? <div className="empty-state"><Truck size={26} /><p>No vehicles match this search.</p></div> : <div className="vehicle-grid">{filteredVehicles.map((vehicle) => <VehicleCard vehicle={vehicle} key={vehicle.externalId} onClick={() => setSelectedVehicle(vehicle)} />)}</div>}
          </section>
        </section>
      </div>
      {selectedVehicle && <VehicleDrawer vehicle={selectedDetail?.currentStatus ?? selectedVehicle} detail={selectedDetail} onClose={() => setSelectedVehicle(null)} />}
    </main>
  )
}

function Header({ connectionState }: { connectionState: string }) {
  return <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Activity size={18} strokeWidth={2.5} /></div><div><div className="brand-name">NORTHSTAR OPS</div><div className="brand-subtitle">Fleet intelligence platform</div></div></div><div className="topbar-actions"><div className={`connection-pill ${connectionState}`}>{connectionState === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}<span>{connectionState === 'connected' ? 'Live connection' : connectionState === 'reconnecting' ? 'Reconnecting' : 'Offline mode'}</span><span className="connection-dot" /></div><div className="operator-chip"><span className="avatar">AM</span><span>Alex Morgan</span><ChevronRight size={14} /></div></div></header>
}

function Sidebar() {
  return <aside className="sidebar"><div className="sidebar-section"><span className="sidebar-label">Workspace</span><button className="nav-item active"><Activity size={17} /> Overview <span className="nav-count">01</span></button><button className="nav-item"><Truck size={17} /> Vehicles <span className="nav-count">64</span></button><button className="nav-item"><ShieldAlert size={17} /> Alerts <span className="nav-count alert-count">07</span></button></div><div className="sidebar-section sidebar-bottom"><span className="sidebar-label">Scope</span><button className="region-button"><MapPin size={16} /> All regions <ChevronRight size={14} /></button><div className="region-list"><span><i className="region-dot north" /> North</span><span className="region-total">16</span><span><i className="region-dot south" /> South</span><span className="region-total">18</span><span><i className="region-dot east" /> East</span><span className="region-total">15</span><span><i className="region-dot west" /> West</span><span className="region-total">15</span></div></div><div className="sidebar-footer"><div className="footer-signal"><Radio size={14} /> Ingestion pipeline <span className="healthy-dot" /></div><span>v0.1.0</span></div></aside>
}

function MetricCard({ label, value, unit, note, icon, tone, loading }: { label: string; value: string | number; unit?: string; note: string; icon: ReactNode; tone: string; loading: boolean }) { return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className={`metric-value ${loading ? 'skeleton-text' : ''}`}>{value}<small>{unit}</small></div><div className="metric-note">{note}</div></article> }

function SpeedChart() { return <section className="panel chart-panel"><div className="panel-heading"><div><span className="panel-kicker">LIVE TELEMETRY</span><h2>Fleet average speed</h2></div><div className="chart-legend"><span className="legend-swatch" /> Current period <strong>47.8 km/h</strong></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={demoSpeedSeries} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}><defs><linearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36c7bb" stopOpacity={0.24} /><stop offset="100%" stopColor="#36c7bb" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#273740" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#687c84', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={[20, 70]} tick={{ fill: '#687c84', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#172229', border: '1px solid #2d444c', borderRadius: 4, color: '#e9f1f0' }} labelStyle={{ color: '#7f969d' }} /><Area type="monotone" dataKey="speed" stroke="#36c7bb" strokeWidth={2} fill="url(#speedFill)" dot={false} activeDot={{ r: 4, fill: '#36c7bb', stroke: '#172229', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div><div className="chart-footer"><span><i className="trend-up">↑ 4.2%</i> vs previous period</span><span>Updates every 30 sec</span></div></section> }

function AlertsPanel({ alerts }: { alerts: FleetAlertResponse[] }) { return <section className="panel alerts-panel"><div className="panel-heading"><div><span className="panel-kicker">ATTENTION QUEUE</span><h2>Recent alerts</h2></div><button className="text-button">View all <ChevronRight size={14} /></button></div><div className="alert-list">{alerts.length === 0 ? <div className="empty-state compact-empty"><ShieldAlert size={20} /><p>No active threshold alerts.</p></div> : alerts.slice(0, 4).map((alert) => <div className="alert-row" key={alert.id}><div className={`alert-icon ${alert.severity.toLowerCase()}`}><ShieldAlert size={15} /></div><div className="alert-copy"><strong>{alert.vehicleExternalId}</strong><span>{alert.message}</span><small>{formatAlertTime(alert.triggeredAt)}</small></div><ChevronRight className="alert-chevron" size={15} /></div>)}</div><button className="panel-footer-button">Open alert center <ChevronRight size={14} /></button></section> }

function formatAlertTime(triggeredAt: string) { const minutes = Math.max(1, Math.round((Date.now() - new Date(triggeredAt).getTime()) / 60_000)); return `${minutes} min ago` }

function VehicleCard({ vehicle, onClick }: { vehicle: VehicleStatusResponse; onClick: () => void }) { const meta = statusMeta[vehicle.status]; return <button className="vehicle-card" onClick={onClick}><div className="vehicle-top"><span className={`status-dot ${meta.className}`} /><strong>{vehicle.externalId}</strong><span className={`status-label ${meta.className}`}>{meta.label}</span><ChevronRight size={14} className="vehicle-chevron" /></div><div className="vehicle-name">{vehicle.name} <span>· {vehicle.region}</span></div><div className="vehicle-stats"><span><Gauge size={13} /> {vehicle.speedKph ?? '--'} <i>km/h</i></span><span><Fuel size={13} /> {vehicle.fuelPercent ?? '--'}<i>%</i></span><span><Thermometer size={13} /> {vehicle.engineTemperatureCelsius ?? '--'}<i>°</i></span></div></button> }

function VehicleDrawer({ vehicle, detail, onClose }: { vehicle: VehicleStatusResponse; detail: VehicleDetailResponse | null; onClose: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="vehicle-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="panel-kicker">VEHICLE DETAIL</span><h2>{vehicle.externalId}</h2><p>{vehicle.name} · {vehicle.region}</p></div><button className="icon-button" onClick={onClose} aria-label="Close vehicle detail"><X size={18} /></button></div><div className="drawer-status"><span className={`status-dot ${statusMeta[vehicle.status].className}`} /><strong>{statusMeta[vehicle.status].label}</strong><span>Updated {vehicle.observedAt ? new Date(vehicle.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown'}</span></div><div className="drawer-coordinates"><MapPin size={15} /><span>{vehicle.latitude?.toFixed(4)}, {vehicle.longitude?.toFixed(4)}</span></div><div className="drawer-metrics"><div><Gauge size={16} /><span>Speed</span><strong>{vehicle.speedKph ?? '--'} <small>km/h</small></strong></div><div><Fuel size={16} /><span>Fuel level</span><strong>{vehicle.fuelPercent ?? '--'} <small>%</small></strong></div><div><Thermometer size={16} /><span>Engine temp</span><strong>{vehicle.engineTemperatureCelsius ?? '--'} <small>°C</small></strong></div></div><div className="drawer-section"><span className="panel-kicker">RECENT EVENTS</span>{detail?.alerts.length ? detail.alerts.slice(0, 3).map((alert) => <div className="event-item" key={alert.id}><span className={`event-line ${alert.severity === 'Critical' ? 'critical-line' : ''}`} /><div><strong>{alert.code}</strong><small>{alert.message}</small></div><time>{formatAlertTime(alert.triggeredAt)}</time></div>) : <div className="event-item"><span className="event-line" /><div><strong>{detail ? 'No threshold breaches' : 'Loading vehicle history'}</strong><small>{detail ? 'Recent telemetry is within configured limits' : 'Requesting recent telemetry and alert history'}</small></div></div>}</div></aside></div> }

export default App
