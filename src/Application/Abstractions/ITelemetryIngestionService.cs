using OpsDashboard.Application.Telemetry;

namespace OpsDashboard.Application.Abstractions;

public interface ITelemetryIngestionService
{
    Task<TelemetryBatchResponse> IngestAsync(TelemetryBatchRequest request, CancellationToken cancellationToken);
}
