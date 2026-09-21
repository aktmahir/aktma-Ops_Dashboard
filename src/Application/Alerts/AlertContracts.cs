using OpsDashboard.Domain.Enums;

namespace OpsDashboard.Application.Alerts;

/// <summary>An alert returned in newest-first order for the operations feed.</summary>
public sealed record FleetAlertResponse(
    Guid Id,
    string VehicleExternalId,
    string Code,
    string Message,
    AlertSeverity Severity,
    DateTimeOffset TriggeredAt,
    DateTimeOffset? ResolvedAt);
