using Microsoft.EntityFrameworkCore;
using OpsDashboard.Application.Abstractions;
using OpsDashboard.Application.Realtime;
using OpsDashboard.Application.Telemetry;
using OpsDashboard.Domain.Entities;
using OpsDashboard.Domain.Enums;
using OpsDashboard.Infrastructure.Persistence;

namespace OpsDashboard.Infrastructure.Services;

public sealed class TelemetryIngestionService(
    OpsDashboardDbContext dbContext,
    ITelemetryUpdatePublisher updatePublisher) : ITelemetryIngestionService
{
    public async Task<TelemetryBatchResponse> IngestAsync(TelemetryBatchRequest request, CancellationToken cancellationToken)
    {
        var externalIds = request.Readings.Select(reading => reading.VehicleExternalId).Distinct().ToArray();
        var vehicles = await dbContext.Vehicles
            .Where(vehicle => externalIds.Contains(vehicle.ExternalId))
            .ToDictionaryAsync(vehicle => vehicle.ExternalId, cancellationToken);
        var vehicleIds = vehicles.Values.Select(vehicle => vehicle.Id).ToArray();
        var activeAlerts = await dbContext.Alerts
            .Where(alert => vehicleIds.Contains(alert.VehicleId) && alert.ResolvedAtUtc == null)
            .ToListAsync(cancellationToken);
        var activeAlertCodes = activeAlerts
            .Select(alert => $"{alert.VehicleId}:{alert.Code}")
            .ToHashSet(StringComparer.Ordinal);

        foreach (var reading in request.Readings)
        {
            if (!vehicles.TryGetValue(reading.VehicleExternalId, out var vehicle))
            {
                vehicle = new Vehicle(reading.VehicleExternalId, reading.VehicleName, reading.Region);
                dbContext.Vehicles.Add(vehicle);
                vehicles.Add(vehicle.ExternalId, vehicle);
            }

            vehicle.ApplyTelemetry(reading.SpeedKph);
            dbContext.TelemetryReadings.Add(new TelemetryReading(
                vehicle.Id,
                reading.ObservedAt.UtcDateTime,
                reading.Latitude,
                reading.Longitude,
                reading.SpeedKph,
                reading.FuelPercent,
                reading.EngineTemperatureCelsius));

            AddThresholdAlertIfNeeded(
                vehicle,
                reading.EngineTemperatureCelsius >= 105m,
                "engine-overheat",
                "Engine temperature above 105 C",
                activeAlertCodes,
                reading.ObservedAt.UtcDateTime);
            AddThresholdAlertIfNeeded(
                vehicle,
                reading.FuelPercent <= 15m,
                "low-fuel",
                "Fuel level below 15 percent",
                activeAlertCodes,
                reading.ObservedAt.UtcDateTime);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        foreach (var reading in request.Readings)
        {
            await updatePublisher.PublishAsync(new TelemetryUpdate(
                reading.VehicleExternalId,
                reading.Region,
                reading.ObservedAt,
                reading.Latitude,
                reading.Longitude,
                reading.SpeedKph,
                reading.FuelPercent,
                reading.EngineTemperatureCelsius), cancellationToken);
        }

        return new TelemetryBatchResponse(request.Readings.Count, DateTimeOffset.UtcNow);
    }

    private void AddThresholdAlertIfNeeded(
        Vehicle vehicle,
        bool thresholdBreached,
        string code,
        string message,
        ISet<string> activeAlertCodes,
        DateTime triggeredAtUtc)
    {
        var alertKey = $"{vehicle.Id}:{code}";
        if (!thresholdBreached || !activeAlertCodes.Add(alertKey))
        {
            return;
        }

        dbContext.Alerts.Add(new Alert(vehicle.Id, AlertSeverity.Critical, code, message, triggeredAtUtc));
    }
}
