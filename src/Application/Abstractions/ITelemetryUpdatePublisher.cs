using OpsDashboard.Application.Realtime;

namespace OpsDashboard.Application.Abstractions;

public interface ITelemetryUpdatePublisher
{
    Task PublishAsync(TelemetryUpdate update, CancellationToken cancellationToken);
}
