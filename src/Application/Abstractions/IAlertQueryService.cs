using OpsDashboard.Application.Alerts;

namespace OpsDashboard.Application.Abstractions;

public interface IAlertQueryService
{
    Task<IReadOnlyList<FleetAlertResponse>> GetRecentAsync(int limit, CancellationToken cancellationToken);
}
