using Microsoft.EntityFrameworkCore;
using OpsDashboard.Application.Abstractions;
using OpsDashboard.Application.Telemetry;
using OpsDashboard.Infrastructure.Persistence;

namespace OpsDashboard.Infrastructure.Services;

public sealed class FleetQueryService(OpsDashboardDbContext dbContext) : IFleetQueryService
{
    private static readonly Func<OpsDashboardDbContext, Guid, IAsyncEnumerable<LatestTelemetryProjection>> LatestTelemetryQuery =
        EF.CompileAsyncQuery((OpsDashboardDbContext context, Guid vehicleId) =>
            context.TelemetryReadings
                .AsNoTracking()
                .Where(reading => reading.VehicleId == vehicleId)
                .OrderByDescending(reading => reading.ObservedAtUtc)
                .Select(reading => new LatestTelemetryProjection(
                    reading.ObservedAtUtc,
                    reading.Latitude,
                    reading.Longitude,
                    reading.SpeedKph,
                    reading.FuelPercent,
                    reading.EngineTemperatureCelsius))
                .Take(1));

    public async Task<IReadOnlyList<VehicleStatusResponse>> GetLatestStatusAsync(CancellationToken cancellationToken)
    {
        var vehicles = await dbContext.Vehicles
            .AsNoTracking()
            .OrderBy(vehicle => vehicle.ExternalId)
            .ToListAsync(cancellationToken);

        var result = new List<VehicleStatusResponse>(vehicles.Count);
        foreach (var vehicle in vehicles)
        {
            LatestTelemetryProjection? latest = null;
            await foreach (var projection in LatestTelemetryQuery(dbContext, vehicle.Id).WithCancellation(cancellationToken))
            {
                latest = projection;
                break;
            }

            result.Add(new VehicleStatusResponse(
                vehicle.Id,
                vehicle.ExternalId,
                vehicle.Name,
                vehicle.Region,
                vehicle.Status,
                latest is null ? null : new DateTimeOffset(DateTime.SpecifyKind(latest.ObservedAtUtc, DateTimeKind.Utc)),
                latest?.Latitude,
                latest?.Longitude,
                latest?.SpeedKph,
                latest?.FuelPercent,
                latest?.EngineTemperatureCelsius));
        }

        return result;
    }

    public async Task<IReadOnlyList<VehicleStatusResponse>> GetLatestStatusNaiveAsync(CancellationToken cancellationToken)
    {
        var vehicles = await dbContext.Vehicles
            .AsNoTracking()
            .OrderBy(vehicle => vehicle.ExternalId)
            .ToListAsync(cancellationToken);

        var result = new List<VehicleStatusResponse>(vehicles.Count);
        foreach (var vehicle in vehicles)
        {
            var latest = await dbContext.TelemetryReadings
                .AsNoTracking()
                .Where(reading => reading.VehicleId == vehicle.Id)
                .OrderByDescending(reading => reading.ObservedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            result.Add(ToStatusResponse(vehicle, latest));
        }

        return result;
    }

    public async Task<VehicleDetailResponse?> GetVehicleDetailAsync(string externalId, CancellationToken cancellationToken)
    {
        var vehicle = await dbContext.Vehicles
            .AsNoTracking()
            .AsSplitQuery()
            .Include(item => item.TelemetryReadings.OrderByDescending(reading => reading.ObservedAtUtc).Take(100))
            .Include(item => item.Alerts.OrderByDescending(alert => alert.TriggeredAtUtc).Take(50))
            .SingleOrDefaultAsync(item => item.ExternalId == externalId, cancellationToken);

        if (vehicle is null)
        {
            return null;
        }

        var latest = vehicle.TelemetryReadings.OrderByDescending(reading => reading.ObservedAtUtc).FirstOrDefault();
        var currentStatus = new VehicleStatusResponse(
            vehicle.Id,
            vehicle.ExternalId,
            vehicle.Name,
            vehicle.Region,
            vehicle.Status,
            latest is null ? null : ToUtcOffset(latest.ObservedAtUtc),
            latest?.Latitude,
            latest?.Longitude,
            latest?.SpeedKph,
            latest?.FuelPercent,
            latest?.EngineTemperatureCelsius);

        return new VehicleDetailResponse(
            currentStatus,
            vehicle.TelemetryReadings.Select(reading => new TelemetryHistoryResponse(
                ToUtcOffset(reading.ObservedAtUtc),
                reading.Latitude,
                reading.Longitude,
                reading.SpeedKph,
                reading.FuelPercent,
                reading.EngineTemperatureCelsius)).ToArray(),
            vehicle.Alerts.Select(alert => new AlertResponse(
                alert.Id,
                alert.Code,
                alert.Message,
                alert.Severity,
                ToUtcOffset(alert.TriggeredAtUtc),
                alert.ResolvedAtUtc.HasValue ? ToUtcOffset(alert.ResolvedAtUtc.Value) : null)).ToArray());
    }

    private static DateTimeOffset ToUtcOffset(DateTime value) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Utc));

    private static VehicleStatusResponse ToStatusResponse(
        OpsDashboard.Domain.Entities.Vehicle vehicle,
        OpsDashboard.Domain.Entities.TelemetryReading? latest) =>
        new(
            vehicle.Id,
            vehicle.ExternalId,
            vehicle.Name,
            vehicle.Region,
            vehicle.Status,
            latest is null ? null : ToUtcOffset(latest.ObservedAtUtc),
            latest?.Latitude,
            latest?.Longitude,
            latest?.SpeedKph,
            latest?.FuelPercent,
            latest?.EngineTemperatureCelsius);

    private sealed record LatestTelemetryProjection(
        DateTime ObservedAtUtc,
        double Latitude,
        double Longitude,
        decimal SpeedKph,
        decimal FuelPercent,
        decimal EngineTemperatureCelsius);
}
