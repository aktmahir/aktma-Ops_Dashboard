using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using OpsDashboard.Api.Realtime;
using OpsDashboard.Application.Abstractions;
using OpsDashboard.Application.Realtime;

namespace OpsDashboard.Api.Realtime;

public sealed class SignalRTelemetryUpdatePublisher(
    IHubContext<FleetHub> hubContext,
    ILogger<SignalRTelemetryUpdatePublisher> logger) : ITelemetryUpdatePublisher
{
    private static readonly TimeSpan MinimumInterval = TimeSpan.FromSeconds(1);
    private readonly ConcurrentDictionary<string, SemaphoreSlim> entityLocks = new();

    public async Task PublishAsync(TelemetryUpdate update, CancellationToken cancellationToken)
    {
        var entityLock = entityLocks.GetOrAdd(update.VehicleExternalId, _ => new SemaphoreSlim(1, 1));
        await entityLock.WaitAsync(cancellationToken);
        try
        {
            var now = DateTimeOffset.UtcNow;
            if (now - LastSentAt.GetOrAdd(update.VehicleExternalId, DateTimeOffset.MinValue) < MinimumInterval)
            {
                return;
            }

            LastSentAt[update.VehicleExternalId] = now;
            await hubContext.Clients
                .Group(FleetHub.RegionGroup(update.Region))
                .SendAsync("telemetryUpdated", update, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Unable to publish telemetry update for vehicle {VehicleExternalId}", update.VehicleExternalId);
        }
        finally
        {
            entityLock.Release();
        }
    }

    private static readonly ConcurrentDictionary<string, DateTimeOffset> LastSentAt = new();
}
