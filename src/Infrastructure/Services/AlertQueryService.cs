using Microsoft.EntityFrameworkCore;
using OpsDashboard.Application.Abstractions;
using OpsDashboard.Application.Alerts;
using OpsDashboard.Infrastructure.Persistence;

namespace OpsDashboard.Infrastructure.Services;

public sealed class AlertQueryService(OpsDashboardDbContext dbContext) : IAlertQueryService
{
    public async Task<IReadOnlyList<FleetAlertResponse>> GetRecentAsync(int limit, CancellationToken cancellationToken)
    {
        var boundedLimit = Math.Clamp(limit, 1, 100);
        return await dbContext.Alerts
            .AsNoTracking()
            .OrderByDescending(alert => alert.TriggeredAtUtc)
            .Take(boundedLimit)
            .Select(alert => new FleetAlertResponse(
                alert.Id,
                alert.Vehicle.ExternalId,
                alert.Code,
                alert.Message,
                alert.Severity,
                new DateTimeOffset(DateTime.SpecifyKind(alert.TriggeredAtUtc, DateTimeKind.Utc)),
                alert.ResolvedAtUtc.HasValue
                    ? new DateTimeOffset(DateTime.SpecifyKind(alert.ResolvedAtUtc.Value, DateTimeKind.Utc))
                    : null))
            .ToListAsync(cancellationToken);
    }
}
