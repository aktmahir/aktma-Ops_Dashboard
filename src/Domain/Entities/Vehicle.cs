using OpsDashboard.Domain.Enums;

namespace OpsDashboard.Domain.Entities;

public sealed class Vehicle
{
    private Vehicle()
    {
    }

    public Vehicle(string externalId, string name, string region)
    {
        Id = Guid.NewGuid();
        ExternalId = externalId;
        Name = name;
        Region = region;
        Status = VehicleStatus.Offline;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public string ExternalId { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Region { get; private set; } = string.Empty;
    public VehicleStatus Status { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public ICollection<TelemetryReading> TelemetryReadings { get; private set; } = new List<TelemetryReading>();
    public ICollection<Alert> Alerts { get; private set; } = new List<Alert>();

    public void ApplyTelemetry(decimal speedKph)
    {
        Status = speedKph > 1m ? VehicleStatus.Moving : VehicleStatus.Idle;
    }
}
