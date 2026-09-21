import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const apiUrl = __ENV.API_URL || 'http://localhost:5000';
const wsUrl = apiUrl.replace(/^http/, 'ws');
const targetVUs = Number(__ENV.TARGET_VUS || 500);
const connectionDuration = __ENV.CONNECTION_DURATION || '4m';

export const options = {
  scenarios: {
    signalr_connections: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '60s', target: 100 },
        { duration: '60s', target: targetVUs },
        { duration: connectionDuration, target: targetVUs },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    signalr_connection_latency: ['p(95)<2000'],
    signalr_connection_errors: ['count<10'],
  },
};

const connectionLatency = new Trend('signalr_connection_latency');
const connectionErrors = new Counter('signalr_connection_errors');

export default function () {
  const negotiate = http.post(`${apiUrl}/hubs/fleet/negotiate?negotiateVersion=1`);
  const negotiated = check(negotiate, { 'SignalR negotiate succeeded': (response) => response.status === 200 });
  if (!negotiated) {
    connectionErrors.add(1);
    return;
  }

  const connectionToken = negotiate.json('connectionToken') || negotiate.json('connectionId');
  const startedAt = Date.now();
  const response = ws.connect(`${wsUrl}/hubs/fleet?id=${encodeURIComponent(connectionToken)}`, null, (socket) => {
    socket.on('open', () => {
      socket.send(JSON.stringify({ protocol: 'json', version: 1 }) + '\u001e');
      socket.send(JSON.stringify({ type: 1, invocationId: `vu-${__VU}`, target: 'SubscribeRegion', arguments: ['North'] }) + '\u001e');
      connectionLatency.add(Date.now() - startedAt);
      socket.setTimeout(() => socket.close(), 240000);
    });
    socket.on('error', () => connectionErrors.add(1));
  });

  check(response, { 'SignalR WebSocket connected': (result) => result && result.status === 101 });
}

export function handleSummary(data) {
  return {
    [__ENV.RESULT_FILE || 'loadtests/results/signalr-summary.json']: JSON.stringify(data, null, 2),
  };
}
