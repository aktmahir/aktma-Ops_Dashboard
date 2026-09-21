namespace OpsDashboard.Application.Realtime;

public sealed record TelemetryUpdate(
    string VehicleExternalId,
    string Region,
    DateTimeOffset ObservedAt,
    double Latitude,
    double Longitude,
    decimal SpeedKph,
    decimal FuelPercent,
    decimal EngineTemperatureCelsius);
