namespace OpsDashboard.Domain.Events;

public sealed record TelemetryIngestedEvent(Guid VehicleId, DateTime ObservedAtUtc);
