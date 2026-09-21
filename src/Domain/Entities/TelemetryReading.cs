namespace OpsDashboard.Domain.Entities;

public sealed class TelemetryReading
{
    private TelemetryReading()
    {
    }

    public TelemetryReading(Guid vehicleId, DateTime observedAtUtc, double latitude, double longitude, decimal speedKph, decimal fuelPercent, decimal engineTemperatureCelsius)
    {
        Id = Guid.NewGuid();
        VehicleId = vehicleId;
        ObservedAtUtc = observedAtUtc;
        Latitude = latitude;
        Longitude = longitude;
        SpeedKph = speedKph;
        FuelPercent = fuelPercent;
        EngineTemperatureCelsius = engineTemperatureCelsius;
    }

    public Guid Id { get; private set; }
    public Guid VehicleId { get; private set; }
    public DateTime ObservedAtUtc { get; private set; }
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }
    public decimal SpeedKph { get; private set; }
    public decimal FuelPercent { get; private set; }
    public decimal EngineTemperatureCelsius { get; private set; }

    public Vehicle Vehicle { get; private set; } = null!;
}
