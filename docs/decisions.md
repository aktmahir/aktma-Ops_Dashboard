# Design Decisions

## PostgreSQL

PostgreSQL is the database target for local development and the reference deployment shape. It provides strong relational constraints for vehicles, telemetry, and alerts, while Npgsql keeps the .NET integration idiomatic. Docker Compose makes the persistence dependencies reproducible without requiring a hosted environment.

## Persistence Model

Telemetry is append-only history linked to a vehicle. Vehicles hold the current coarse status, while the latest telemetry remains queryable by `(vehicle_id, observed_at_utc)`. Alerts are separate records so unresolved threshold breaches can be indexed and reported without scanning telemetry history.

## Cache Strategy

Fleet-wide aggregates use Redis cache-aside with a five-second TTL. This absorbs repeated dashboard summary reads while keeping freshness acceptable. Redis connection failures are logged and fall back to PostgreSQL. Raw per-vehicle state is not cached: it will be delivered through SignalR and duplicating it in Redis adds invalidation complexity without improving the live path.

## EF Core Optimizations

The hottest latest-status query uses `EF.CompileAsyncQuery`. Read-only projections use `AsNoTracking`, and vehicle/history/alert detail queries use `AsSplitQuery` where multiple collections are included. The benchmark table in the root README will be populated from before/after k6 runs rather than estimates.

## Planned SignalR Delivery

Clients will subscribe to region/fleet-segment groups. This keeps each connection's fan-out bounded and supports horizontal scale through the Redis backplane. Per-entity updates will be coalesced server-side to approximately one update per second so a noisy device cannot overwhelm clients.

## Resilience

Polly v8 retries transient database and Redis summary operations with short exponential backoff and opens a circuit after repeated failures. Redis errors are non-critical for the read path, so the service logs the failure and serves the PostgreSQL result. A database circuit failure is allowed to surface because serving an aggregate without authoritative storage would be misleading.