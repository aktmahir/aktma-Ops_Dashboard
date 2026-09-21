using OpsDashboard.Application.Telemetry;

namespace OpsDashboard.Application.Abstractions;

public interface IFleetQueryService
{
    Task<IReadOnlyList<VehicleStatusResponse>> GetLatestStatusAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<VehicleStatusResponse>> GetLatestStatusNaiveAsync(CancellationToken cancellationToken);
    Task<VehicleDetailResponse?> GetVehicleDetailAsync(string externalId, CancellationToken cancellationToken);
}
