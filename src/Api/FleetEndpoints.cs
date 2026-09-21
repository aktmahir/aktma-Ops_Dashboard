using OpsDashboard.Application.Abstractions;
using OpsDashboard.Application.Telemetry;

namespace OpsDashboard.Api;

public static class FleetEndpoints
{
    public static IEndpointRouteBuilder MapFleetEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api").WithTags("Fleet");

        group.MapPost("/telemetry/batch", async (
            TelemetryBatchRequest request,
            ITelemetryIngestionService ingestionService,
            CancellationToken cancellationToken) =>
        {
            var response = await ingestionService.IngestAsync(request, cancellationToken);
            return TypedResults.Accepted("/api/fleet/status", response);
        })
        .WithName("IngestTelemetryBatch")
        .WithSummary("Ingest a batch of vehicle telemetry")
        .WithOpenApi();

        group.MapGet("/fleet/status", async (
            string? mode,
            IFleetQueryService fleetQueryService,
            CancellationToken cancellationToken) =>
        {
            var response = string.Equals(mode, "naive", StringComparison.OrdinalIgnoreCase)
                ? await fleetQueryService.GetLatestStatusNaiveAsync(cancellationToken)
                : await fleetQueryService.GetLatestStatusAsync(cancellationToken);
            return TypedResults.Ok(response);
        })
        .WithName("GetFleetStatus")
        .WithSummary("Get the latest status for every known vehicle; mode=naive enables the benchmark baseline")
        .WithOpenApi();

        group.MapGet("/fleet/{externalId}", async (
            string externalId,
            IFleetQueryService fleetQueryService,
            CancellationToken cancellationToken) =>
        {
            var response = await fleetQueryService.GetVehicleDetailAsync(externalId, cancellationToken);
            return response is null
                ? Results.NotFound()
                : Results.Ok(response);
        })
        .WithName("GetVehicleDetail")
        .WithSummary("Get recent telemetry history and alerts for one vehicle")
        .WithOpenApi();

        group.MapGet("/fleet/summary", async (
            IFleetSummaryService summaryService,
            CancellationToken cancellationToken) =>
        {
            var response = await summaryService.GetSummaryAsync(cancellationToken);
            return TypedResults.Ok(response);
        })
        .WithName("GetFleetSummary")
        .WithSummary("Get short-lived cached fleet aggregate metrics")
        .WithOpenApi();

        group.MapGet("/alerts", async (
            int? limit,
            IAlertQueryService alertQueryService,
            CancellationToken cancellationToken) =>
        {
            var response = await alertQueryService.GetRecentAsync(limit ?? 20, cancellationToken);
            return TypedResults.Ok(response);
        })
        .WithName("GetRecentAlerts")
        .WithSummary("Get newest threshold alerts")
        .WithOpenApi();

        return endpoints;
    }
}
