using OpsDashboard.Application.Fleet;

namespace OpsDashboard.Application.Abstractions;

public interface IFleetSummaryService
{
    Task<FleetSummaryResponse> GetSummaryAsync(CancellationToken cancellationToken);
}
