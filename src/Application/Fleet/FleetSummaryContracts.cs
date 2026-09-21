namespace OpsDashboard.Application.Fleet;

/// <summary>Short-lived aggregate metrics for the fleet overview.</summary>
public sealed record FleetSummaryResponse(
    int TotalVehicles,
    int ActiveVehicles,
    int OpenAlerts,
    decimal AverageSpeedKph,
    DateTimeOffset GeneratedAt);
