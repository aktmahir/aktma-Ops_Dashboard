using OpsDashboard.Domain.Enums;

namespace OpsDashboard.Domain.Entities;

public sealed class Alert
{
    private Alert()
    {
    }

    public Alert(Guid vehicleId, AlertSeverity severity, string code, string message, DateTime triggeredAtUtc)
    {
        Id = Guid.NewGuid();
        VehicleId = vehicleId;
        Severity = severity;
        Code = code;
        Message = message;
        TriggeredAtUtc = triggeredAtUtc;
    }

    public Guid Id { get; private set; }
    public Guid VehicleId { get; private set; }
    public AlertSeverity Severity { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public DateTime TriggeredAtUtc { get; private set; }
    public DateTime? ResolvedAtUtc { get; private set; }

    public Vehicle Vehicle { get; private set; } = null!;
}
