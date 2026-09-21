import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const apiUrl = __ENV.API_URL || 'http://localhost:5000';
const vehicleCount = Number(__ENV.VEHICLE_COUNT || 50);
const statusMode = __ENV.STATUS_MODE || 'naive';
const resultFile = __ENV.RESULT_FILE || 'loadtests/results/baseline-summary.json';
const rampDuration = __ENV.RAMP_DURATION || '30s';
const steadyDuration = __ENV.STEADY_DURATION || '2m';

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: rampDuration, target: Number(__ENV.BASELINE_VUS || 10) },
        { duration: steadyDuration, target: Number(__ENV.BASELINE_VUS || 10) },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    ingestion_latency: ['p(95)<1000'],
    fleet_status_latency: ['p(95)<1000'],
    fleet_summary_latency: ['p(95)<1000'],
  },
};

const ingestionLatency = new Trend('ingestion_latency');
const fleetStatusLatency = new Trend('fleet_status_latency');
const fleetSummaryLatency = new Trend('fleet_summary_latency');
const rejectedBatches = new Rate('rejected_batches');

function reading(index) {
  return {
    vehicleExternalId: `VH-${String(index + 1).padStart(3, '0')}`,
    vehicleName: `Vehicle ${String(index + 1).padStart(3, '0')}`,
    region: ['North', 'South', 'East', 'West'][index % 4],
    observedAt: new Date().toISOString(),
    latitude: 40 + (index % 10) * 0.01,
    longitude: -74 + (index % 10) * 0.01,
    speedKph: 30 + (index % 50),
    fuelPercent: 80 - (index % 50),
    engineTemperatureCelsius: 84 + (index % 10),
  };
}

export default function () {
  const readings = Array.from({ length: vehicleCount }, (_, index) => reading(index));
  const payload = JSON.stringify({ readings });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const ingestion = http.post(`${apiUrl}/api/telemetry/batch`, payload, params);
  ingestionLatency.add(ingestion.timings.duration);
  const accepted = check(ingestion, { 'telemetry batch accepted': (response) => response.status === 202 });
  rejectedBatches.add(!accepted);

  const fleetStatus = http.get(`${apiUrl}/api/fleet/status?mode=${statusMode}`);
  fleetStatusLatency.add(fleetStatus.timings.duration);
  check(fleetStatus, { 'fleet status returned': (response) => response.status === 200 });

  const fleetSummary = http.get(`${apiUrl}/api/fleet/summary`);
  fleetSummaryLatency.add(fleetSummary.timings.duration);
  check(fleetSummary, { 'fleet summary returned': (response) => response.status === 200 });

  sleep(1);
}

export function handleSummary(data) {
  return {
    [resultFile]: JSON.stringify(data, null, 2),
  };
}
