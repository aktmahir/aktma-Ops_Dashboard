import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Activity, Bell, ChevronDown, ChevronRight, CircleDot, Download, Fuel, Gauge, MapPin, Radio, RefreshCw, Search, ShieldAlert, Thermometer, Truck, Wifi, WifiOff, X } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSignalRConnection } from './hooks/useSignalRConnection'
import { demoAlerts, demoSpeedSeries, demoSummary, demoVehicles } from './data/demoData'
import { getFleetStatus, getFleetSummary, getRecentAlerts, getVehicleDetail, type FleetAlertResponse, type FleetSummaryResponse, type VehicleDetailResponse, type VehicleStatusResponse } from './lib/api'
import './App.css'

const statusMeta = {
  Moving: { label: 'Moving', className: 'healthy' },
  Idle: { label: 'Idle', className: 'warning' },
  Maintenance: { label: 'Service', className: 'critical' },
  Offline: { label: 'Offline', className: 'muted' },
} as const

type Workspace = 'overview' | 'vehicles' | 'alerts'
type Region = 'All' | 'North' | 'South' | 'East' | 'West'
type StatusFilter = 'All' | keyof typeof statusMeta
type AlertFilter = 'All' | 'Critical' | 'Warning'
type SortOrder = 'Recent' | 'Speed' | 'Fuel' | 'Temperature'
type SpeedPoint = { time: string; speed: number }

const regions: Region[] = ['All', 'North', 'South', 'East', 'West']

function App() {
  const [summary, setSummary] = useState<FleetSummaryResponse | null>(null)
  const [vehicles, setVehicles] = useState<VehicleStatusResponse[]>([])
  const [alerts, setAlerts] = useState<FleetAlertResponse[]>([])
  const [speedSeries, setSpeedSeries] = useState<SpeedPoint[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleStatusResponse | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<VehicleDetailResponse | null>(null)
  const [search, setSearch] = useState('')
  const [workspace, setWorkspace] = useState<Workspace>('overview')
  const [region, setRegion] = useState<Region>('All')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [sortOrder, setSortOrder] = useState<SortOrder>('Recent')
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('All')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isDemoAllowed = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'
  const searchRef = useRef<HTMLInputElement>(null)
  const fleetRef = useRef<HTMLElement>(null)
  const alertsRef = useRef<HTMLElement>(null)
  const { connectionState, updates } = useSignalRConnection(region === 'All' ? null : region)

  const refreshDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setIsRefreshing(true)
    try {
      const [nextSummary, nextVehicles, nextAlerts] = await Promise.all([getFleetSummary(), getFleetStatus(), getRecentAlerts()])
      setSummary(nextSummary)
      setVehicles(nextVehicles)
      setAlerts(nextAlerts)
      setSpeedSeries((current) => [...current, { time: formatClock(nextSummary.generatedAt), speed: Number(nextSummary.averageSpeedKph) }].slice(-12))
      setErrorMessage(null)
    } catch {
      if (isDemoAllowed) {
        setSummary(demoSummary)
        setVehicles(demoVehicles)
        setAlerts(demoAlerts.map((alert, index) => ({
          id: `demo-alert-${index}`,
          vehicleExternalId: alert.vehicle,
          code: alert.message.toLowerCase().replaceAll(' ', '-'),
          message: alert.message,
          severity: alert.severity === 'critical' ? 'Critical' : 'Warning',
          triggeredAt: new Date(Date.now() - (index + 1) * 4 * 60_000).toISOString(),
          resolvedAt: null,
        })))
        setSpeedSeries(demoSpeedSeries)
        setErrorMessage('The live API is unavailable. Showing explicitly enabled demo data.')
      } else {
        setSummary(null)
        setVehicles([])
        setAlerts([])
        setSpeedSeries([])
        setSelectedVehicle(null)
        setSelectedDetail(null)
        setErrorMessage('The live API is unavailable. Please verify the backend service and API key configuration.')
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [isDemoAllowed])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshDashboard(), 0)
    const refreshTimer = window.setInterval(() => void refreshDashboard(false), 30_000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(refreshTimer)
    }
  }, [refreshDashboard])

  const liveVehicles = useMemo(() => vehicles.map((vehicle) => ({ ...vehicle, ...(updates[vehicle.externalId] ?? {}) })), [updates, vehicles])
  const scopedVehicles = useMemo(() => region === 'All' ? liveVehicles : liveVehicles.filter((vehicle) => vehicle.region === region), [liveVehicles, region])
  const scopedActiveVehicles = scopedVehicles.filter((vehicle) => vehicle.status === 'Moving' || vehicle.status === 'Idle').length
  const scopedAverageSpeed = scopedVehicles.length > 0 ? scopedVehicles.reduce((total, vehicle) => total + (vehicle.speedKph ?? 0), 0) / scopedVehicles.length : 0
  const regionCounts = useMemo(() => regions.slice(1).reduce<Record<string, number>>((counts, currentRegion) => {
    counts[currentRegion] = liveVehicles.filter((vehicle) => vehicle.region === currentRegion).length
    return counts
  }, {}), [liveVehicles])
  const filteredVehicles = useMemo(() => liveVehicles.filter((vehicle) => {
    const matchesSearch = `${vehicle.externalId} ${vehicle.name} ${vehicle.region}`.toLowerCase().includes(search.toLowerCase())
    const matchesRegion = region === 'All' || vehicle.region === region
    const matchesStatus = statusFilter === 'All' || vehicle.status === statusFilter
    return matchesSearch && matchesRegion && matchesStatus
  }), [liveVehicles, region, search, statusFilter])
  const sortedVehicles = useMemo(() => [...filteredVehicles].sort((left, right) => {
    if (sortOrder === 'Speed') return (right.speedKph ?? -1) - (left.speedKph ?? -1)
    if (sortOrder === 'Fuel') return (left.fuelPercent ?? Number.POSITIVE_INFINITY) - (right.fuelPercent ?? Number.POSITIVE_INFINITY)
    if (sortOrder === 'Temperature') return (right.engineTemperatureCelsius ?? -1) - (left.engineTemperatureCelsius ?? -1)
    return new Date(right.observedAt ?? 0).getTime() - new Date(left.observedAt ?? 0).getTime()
  }), [filteredVehicles, sortOrder])
  const visibleAlerts = useMemo(() => {
    if (region === 'All') return alerts
    const regionVehicles = new Set(liveVehicles.filter((vehicle) => vehicle.region === region).map((vehicle) => vehicle.externalId))
    return alerts.filter((alert) => regionVehicles.has(alert.vehicleExternalId))
  }, [alerts, liveVehicles, region])
  const filteredAlerts = useMemo(() => alertFilter === 'All' ? visibleAlerts : visibleAlerts.filter((alert) => alert.severity === alertFilter), [alertFilter, visibleAlerts])

  useEffect(() => {
    if (!selectedVehicle) return
    let active = true
    void getVehicleDetail(selectedVehicle.externalId)
      .then((detail) => active && setSelectedDetail(detail))
      .catch(() => active && setSelectedDetail(null))
    return () => { active = false }
  }, [selectedVehicle])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setSelectedVehicle(null)
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const focusSearch = () => searchRef.current?.focus()
  const showWorkspace = (nextWorkspace: Workspace) => {
    setWorkspace(nextWorkspace)
    if (nextWorkspace === 'vehicles') fleetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (nextWorkspace === 'alerts') alertsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const selectAlert = (alert: FleetAlertResponse) => {
    const vehicle = liveVehicles.find((item) => item.externalId === alert.vehicleExternalId)
    if (vehicle) setSelectedVehicle(vehicle)
  }
  const exportFleet = () => {
    const header = ['Vehicle ID', 'Name', 'Region', 'Status', 'Observed At', 'Speed Kph', 'Fuel Percent', 'Engine Temperature Celsius']
    const rows = filteredVehicles.map((vehicle) => [vehicle.externalId, vehicle.name, vehicle.region, vehicle.status, vehicle.observedAt ?? '', vehicle.speedKph ?? '', vehicle.fuelPercent ?? '', vehicle.engineTemperatureCelsius ?? ''])
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `fleet-${region.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <main className="app-shell">
      <Header connectionState={connectionState} onSearch={focusSearch} onNotifications={() => showWorkspace('alerts')} onRefresh={() => void refreshDashboard()} isRefreshing={isRefreshing} />
      <div className="workspace">
        <Sidebar workspace={workspace} onWorkspace={showWorkspace} region={region} onRegionChange={setRegion} regionCounts={regionCounts} totalVehicles={liveVehicles.length} alertCount={visibleAlerts.length} />
        <section className="content">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> COMMAND CENTER</div><h1>{workspace === 'alerts' ? 'Alert center' : workspace === 'vehicles' ? 'Vehicle network' : 'Fleet overview'}</h1><p>{workspace === 'alerts' ? 'Review the newest threshold events across your operation.' : workspace === 'vehicles' ? 'Search, filter, and inspect every connected vehicle.' : 'Operational awareness across your connected fleet.'}</p></div>
            <div className="heading-meta"><span className="refresh-label"><span className="live-pulse" /> {summary ? `Last sync ${new Date(summary.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })} UTC` : 'Waiting for live data'}</span><button className="icon-button" aria-label="Search fleet" onClick={focusSearch}><Search size={17} /></button><button className="icon-button" aria-label="Refresh dashboard" onClick={() => void refreshDashboard()}><RefreshCw className={isRefreshing ? 'spin-icon' : ''} size={16} /></button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => showWorkspace('alerts')}><Bell size={17} /><span /></button></div>
          </div>
          {errorMessage && <div className="demo-banner"><CircleDot size={14} /> {errorMessage}</div>}
          <div className="metric-grid">
            <MetricCard label="Total vehicles" value={summary ? (region === 'All' ? summary.totalVehicles : scopedVehicles.length) : '--'} note={`${scopedVehicles.length} in current scope`} icon={<Truck size={17} />} tone="teal" loading={isLoading} />
            <MetricCard label="Active vehicles" value={summary ? (region === 'All' ? summary.activeVehicles : scopedActiveVehicles) : '--'} note={summary ? `${Math.round((scopedActiveVehicles / Math.max(scopedVehicles.length, 1)) * 100)}% of scope` : 'Awaiting data'} icon={<Gauge size={17} />} tone="green" loading={isLoading} />
            <MetricCard label="Open alerts" value={summary ? (region === 'All' ? summary.openAlerts : visibleAlerts.length) : '--'} note={`${visibleAlerts.length} in current scope`} icon={<ShieldAlert size={17} />} tone="red" loading={isLoading} />
            <MetricCard label="Average speed" value={summary ? `${region === 'All' ? summary.averageSpeedKph : scopedAverageSpeed.toFixed(1)}` : '--'} unit="km/h" note="Last 5 minutes" icon={<Activity size={17} />} tone="amber" loading={isLoading} />
          </div>
          <div className="primary-grid"><SpeedChart data={speedSeries} /><div ref={alertsRef as React.RefObject<HTMLDivElement>}><AlertsPanel alerts={filteredAlerts} total={visibleAlerts.length} severity={alertFilter} onSeverityChange={setAlertFilter} expanded={showAllAlerts} onToggle={() => setShowAllAlerts((current) => !current)} onSelect={selectAlert} /></div></div>
          <section className="panel fleet-panel" ref={fleetRef}>
            <div className="panel-heading fleet-heading"><div><span className="panel-kicker">FLEET STATUS</span><h2>Vehicle network <span className="heading-count">{filteredVehicles.length} visible</span></h2></div><div className="fleet-tools"><div className="search-field"><Search size={14} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle or region" /></div><div className="filter-wrap"><button className="filter-button" onClick={() => setIsFilterOpen((current) => !current)}>Status: {statusFilter} <ChevronDown size={13} /></button>{isFilterOpen && <div className="filter-menu">{(['All', ...Object.keys(statusMeta)] as StatusFilter[]).map((status) => <button className={statusFilter === status ? 'selected' : ''} key={status} onClick={() => { setStatusFilter(status); setIsFilterOpen(false) }}>{status}</button>)}</div>}</div><label className="sort-control">Sort<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} aria-label="Sort vehicles"><option value="Recent">Recent</option><option value="Speed">Speed</option><option value="Fuel">Lowest fuel</option><option value="Temperature">Temperature</option></select></label><button className="export-button" onClick={exportFleet}><Download size={13} /> Export CSV</button></div></div>
            {isLoading ? <div className="empty-state"><div className="loading-orbit" /><p>Loading fleet telemetry...</p></div> : errorMessage && !isDemoAllowed ? <div className="empty-state"><Truck size={26} /><p>Live fleet telemetry is unavailable.</p></div> : sortedVehicles.length === 0 ? <div className="empty-state"><Truck size={26} /><p>No vehicles match this search or filter.</p></div> : <div className="vehicle-grid">{sortedVehicles.map((vehicle) => <VehicleCard vehicle={vehicle} key={vehicle.externalId} onClick={() => setSelectedVehicle(vehicle)} />)}</div>}
          </section>
        </section>
      </div>
      {selectedVehicle && <VehicleDrawer vehicle={selectedDetail?.currentStatus ?? liveVehicles.find((vehicle) => vehicle.externalId === selectedVehicle.externalId) ?? selectedVehicle} detail={selectedDetail} onClose={() => { setSelectedVehicle(null); setSelectedDetail(null) }} />}
    </main>
  )
}

function formatClock(value: string) { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

function Header({ connectionState, onSearch, onNotifications, onRefresh, isRefreshing }: { connectionState: string; onSearch: () => void; onNotifications: () => void; onRefresh: () => void; isRefreshing: boolean }) {
  return <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Activity size={18} strokeWidth={2.5} /></div><div><div className="brand-name">NORTHSTAR OPS</div><div className="brand-subtitle">Fleet intelligence platform</div></div></div><div className="topbar-actions"><div className={`connection-pill ${connectionState}`}><span>{connectionState === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}</span><span>{connectionState === 'connected' ? 'Live connection' : connectionState === 'reconnecting' ? 'Reconnecting' : 'Offline mode'}</span><span className="connection-dot" /></div><button className="icon-button" aria-label="Search fleet" onClick={onSearch}><Search size={16} /></button><button className="icon-button" aria-label="Refresh dashboard" onClick={onRefresh}><RefreshCw className={isRefreshing ? 'spin-icon' : ''} size={15} /></button><button className="icon-button notification-button" aria-label="Notifications" onClick={onNotifications}><Bell size={16} /><span /></button><button className="operator-chip" aria-label="Open operator profile"><span className="avatar">AM</span><span>Alex Morgan</span><ChevronRight size={14} /></button></div></header>
}

function Sidebar({ workspace, onWorkspace, region, onRegionChange, regionCounts, totalVehicles, alertCount }: { workspace: Workspace; onWorkspace: (workspace: Workspace) => void; region: Region; onRegionChange: (region: Region) => void; regionCounts: Record<string, number>; totalVehicles: number; alertCount: number }) {
  return <aside className="sidebar"><div className="sidebar-section"><span className="sidebar-label">Workspace</span><button className={`nav-item ${workspace === 'overview' ? 'active' : ''}`} onClick={() => onWorkspace('overview')}><Activity size={17} /> Overview <span className="nav-count">01</span></button><button className={`nav-item ${workspace === 'vehicles' ? 'active' : ''}`} onClick={() => onWorkspace('vehicles')}><Truck size={17} /> Vehicles <span className="nav-count">{totalVehicles}</span></button><button className={`nav-item ${workspace === 'alerts' ? 'active' : ''}`} onClick={() => onWorkspace('alerts')}><ShieldAlert size={17} /> Alerts <span className="nav-count alert-count">{alertCount}</span></button></div><div className="sidebar-section sidebar-bottom"><span className="sidebar-label">Scope</span><div className="region-picker">{regions.map((currentRegion) => <button className={region === currentRegion ? 'selected' : ''} key={currentRegion} onClick={() => onRegionChange(currentRegion)}><MapPin size={14} /> {currentRegion === 'All' ? 'All regions' : currentRegion}<span>{currentRegion === 'All' ? totalVehicles : regionCounts[currentRegion] ?? 0}</span></button>)}</div><div className="region-list">{regions.slice(1).map((currentRegion) => <div className="region-row" key={currentRegion}><span><i className={`region-dot ${currentRegion.toLowerCase()}`} /> {currentRegion}</span><span className="region-total">{regionCounts[currentRegion] ?? 0}</span></div>)}</div></div><div className="sidebar-footer"><div className="footer-signal"><Radio size={14} /> Ingestion pipeline <span className="healthy-dot" /></div><span>v0.1.0</span></div></aside>
}

function MetricCard({ label, value, unit, note, icon, tone, loading }: { label: string; value: string | number; unit?: string; note: string; icon: ReactNode; tone: string; loading: boolean }) { return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className={`metric-value ${loading ? 'skeleton-text' : ''}`}>{value}<small>{unit}</small></div><div className="metric-note">{note}</div></article> }

function SpeedChart({ data }: { data: SpeedPoint[] }) { return <section className="panel chart-panel"><div className="panel-heading"><div><span className="panel-kicker">LIVE TELEMETRY</span><h2>Fleet average speed</h2></div><div className="chart-legend"><span className="legend-swatch" /> <strong>{data.length > 0 ? `${data[data.length - 1]?.speed ?? 0} km/h` : 'Awaiting live data'}</strong></div></div><div className="chart-wrap">{data.length === 0 ? <div className="empty-state compact-empty"><Activity size={20} /><p>No live telemetry yet.</p></div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}><defs><linearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36c7bb" stopOpacity={0.24} /><stop offset="100%" stopColor="#36c7bb" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#273740" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#687c84', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fill: '#687c84', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#172229', border: '1px solid #2d444c', borderRadius: 4, color: '#e9f1f0' }} labelStyle={{ color: '#7f969d' }} /><Area type="monotone" dataKey="speed" stroke="#36c7bb" strokeWidth={2} fill="url(#speedFill)" dot={false} activeDot={{ r: 4, fill: '#36c7bb', stroke: '#172229', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer>}</div><div className="chart-footer"><span>{data.length > 0 ? <><i className="trend-up">● Live</i> current snapshot</> : <span>Waiting for live data</span>}</span><span>Refreshes every 30 sec</span></div></section> }

function AlertsPanel({ alerts, total, severity, onSeverityChange, expanded, onToggle, onSelect }: { alerts: FleetAlertResponse[]; total: number; severity: AlertFilter; onSeverityChange: (severity: AlertFilter) => void; expanded: boolean; onToggle: () => void; onSelect: (alert: FleetAlertResponse) => void }) { const visibleAlerts = expanded ? alerts : alerts.slice(0, 4); return <section className="panel alerts-panel"><div className="panel-heading"><div><span className="panel-kicker">ATTENTION QUEUE</span><h2>Recent alerts <span className="heading-count">{alerts.length}/{total}</span></h2></div><button className="text-button" onClick={onToggle}>{expanded ? 'Collapse' : 'View all'} <ChevronRight size={14} /></button></div><div className="alert-filters">{(['All', 'Critical', 'Warning'] as AlertFilter[]).map((filter) => <button className={severity === filter ? 'selected' : ''} key={filter} onClick={() => onSeverityChange(filter)}>{filter}</button>)}</div><div className="alert-list">{visibleAlerts.length === 0 ? <div className="empty-state compact-empty"><ShieldAlert size={20} /><p>No alerts match this filter.</p></div> : visibleAlerts.map((alert) => <button className="alert-row" key={alert.id} onClick={() => onSelect(alert)}><div className={`alert-icon ${alert.severity.toLowerCase()}`}><ShieldAlert size={15} /></div><div className="alert-copy"><strong>{alert.vehicleExternalId}</strong><span>{alert.message}</span><small>{formatAlertTime(alert.triggeredAt)}</small></div><ChevronRight className="alert-chevron" size={15} /></button>)}</div><button className="panel-footer-button" onClick={onToggle}>{expanded ? 'Close alert center' : 'Open alert center'} <ChevronRight size={14} /></button></section> }

function formatAlertTime(triggeredAt: string) { const minutes = Math.max(1, Math.round((Date.now() - new Date(triggeredAt).getTime()) / 60_000)); return `${minutes} min ago` }

function VehicleCard({ vehicle, onClick }: { vehicle: VehicleStatusResponse; onClick: () => void }) { const meta = statusMeta[vehicle.status]; return <button className="vehicle-card" onClick={onClick}><div className="vehicle-top"><span className={`status-dot ${meta.className}`} /><strong>{vehicle.externalId}</strong><span className={`status-label ${meta.className}`}>{meta.label}</span><ChevronRight size={14} className="vehicle-chevron" /></div><div className="vehicle-name">{vehicle.name} <span>· {vehicle.region}</span></div><div className="vehicle-stats"><span><Gauge size={13} /> {vehicle.speedKph ?? '--'} <i>km/h</i></span><span><Fuel size={13} /> {vehicle.fuelPercent ?? '--'}<i>%</i></span><span><Thermometer size={13} /> {vehicle.engineTemperatureCelsius ?? '--'}<i>°</i></span></div></button> }

function VehicleDrawer({ vehicle, detail, onClose }: { vehicle: VehicleStatusResponse; detail: VehicleDetailResponse | null; onClose: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="vehicle-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="panel-kicker">VEHICLE DETAIL</span><h2>{vehicle.externalId}</h2><p>{vehicle.name} · {vehicle.region}</p></div><button className="icon-button" onClick={onClose} aria-label="Close vehicle detail"><X size={18} /></button></div><div className="drawer-status"><span className={`status-dot ${statusMeta[vehicle.status].className}`} /><strong>{statusMeta[vehicle.status].label}</strong><span>Updated {vehicle.observedAt ? new Date(vehicle.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown'}</span></div><div className="drawer-coordinates"><MapPin size={15} /><span>{vehicle.latitude?.toFixed(4)}, {vehicle.longitude?.toFixed(4)}</span></div><div className="drawer-metrics"><div><Gauge size={16} /><span>Speed</span><strong>{vehicle.speedKph ?? '--'} <small>km/h</small></strong></div><div><Fuel size={16} /><span>Fuel level</span><strong>{vehicle.fuelPercent ?? '--'} <small>%</small></strong></div><div><Thermometer size={16} /><span>Engine temp</span><strong>{vehicle.engineTemperatureCelsius ?? '--'} <small>°C</small></strong></div></div><div className="drawer-section"><span className="panel-kicker">TELEMETRY HISTORY</span>{detail?.history.length ? <div className="history-list">{detail.history.slice(0, 5).map((reading) => <div className="history-row" key={reading.observedAt}><time>{new Date(reading.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span>{reading.speedKph} km/h</span><span>{reading.fuelPercent}% fuel</span><span>{reading.engineTemperatureCelsius}°C</span></div>)}</div> : <div className="event-item"><span className="event-line" /><div><strong>{detail ? 'No telemetry history' : 'Loading telemetry history'}</strong><small>{detail ? 'No recent readings were returned.' : 'Fetching recent readings from the API.'}</small></div></div>}</div><div className="drawer-section"><span className="panel-kicker">RECENT EVENTS</span>{detail?.alerts.length ? detail.alerts.slice(0, 3).map((alert) => <div className="event-item" key={alert.id}><span className={`event-line ${alert.severity === 'Critical' ? 'critical-line' : ''}`} /><div><strong>{alert.code}</strong><small>{alert.message}</small></div><time>{formatAlertTime(alert.triggeredAt)}</time></div>) : <div className="event-item"><span className="event-line" /><div><strong>{detail ? 'No threshold breaches' : 'Loading vehicle history'}</strong><small>{detail ? 'Recent telemetry is within normal thresholds.' : 'Fetching recent events from the API.'}</small></div></div>}</div></aside></div> }

export default App
