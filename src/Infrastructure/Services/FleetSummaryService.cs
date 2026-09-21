using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpsDashboard.Application.Abstractions;
using OpsDashboard.Application.Fleet;
using OpsDashboard.Domain.Enums;
using OpsDashboard.Infrastructure.Persistence;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;
using StackExchange.Redis;

namespace OpsDashboard.Infrastructure.Services;

public sealed class FleetSummaryService(
    OpsDashboardDbContext dbContext,
    IConnectionMultiplexer redis,
    ILogger<FleetSummaryService> logger) : IFleetSummaryService
{
    private const string CacheKey = "ops:fleet:summary:v1";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan CacheOperationTimeout = TimeSpan.FromMilliseconds(400);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly ResiliencePipeline<RedisValue> RedisReadPipeline = BuildRedisReadPipeline();
    private static readonly ResiliencePipeline<bool> RedisWritePipeline = BuildRedisWritePipeline();
    private static readonly ResiliencePipeline<FleetSummaryResponse> DatabasePipeline = BuildDatabasePipeline();

    public async Task<FleetSummaryResponse> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var database = redis.GetDatabase();
        try
        {
            var cached = await RedisReadPipeline.ExecuteAsync(
                _ => new ValueTask<RedisValue>(database.StringGetAsync(CacheKey).WaitAsync(CacheOperationTimeout, cancellationToken)),
                cancellationToken);
            if (cached.HasValue)
            {
                var cachedSummary = JsonSerializer.Deserialize<FleetSummaryResponse>(cached!, JsonOptions);
                if (cachedSummary is not null)
                {
                    return cachedSummary;
                }
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Redis unavailable while reading fleet summary; falling back to PostgreSQL");
        }

        var summary = await DatabasePipeline.ExecuteAsync(
            token => new ValueTask<FleetSummaryResponse>(LoadFromDatabaseAsync(token)),
            cancellationToken);

        try
        {
            await RedisWritePipeline.ExecuteAsync(
                _ => new ValueTask<bool>(database.StringSetAsync(CacheKey, JsonSerializer.Serialize(summary, JsonOptions), CacheTtl).WaitAsync(CacheOperationTimeout, cancellationToken)),
                cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Redis unavailable while writing fleet summary; serving the database result");
        }

        return summary;
    }

    private static ResiliencePipeline<RedisValue> BuildRedisReadPipeline() =>
        new ResiliencePipelineBuilder<RedisValue>()
            .AddRetry(new RetryStrategyOptions<RedisValue>
            {
                MaxRetryAttempts = 2,
                Delay = TimeSpan.FromMilliseconds(100),
                ShouldHandle = new PredicateBuilder<RedisValue>().Handle<RedisException>()
            })
            .AddCircuitBreaker(new CircuitBreakerStrategyOptions<RedisValue>
            {
                FailureRatio = 0.5,
                MinimumThroughput = 5,
                SamplingDuration = TimeSpan.FromSeconds(30),
                BreakDuration = TimeSpan.FromSeconds(15),
                ShouldHandle = new PredicateBuilder<RedisValue>().Handle<RedisException>()
            })
            .Build();

    private static ResiliencePipeline<bool> BuildRedisWritePipeline() =>
        new ResiliencePipelineBuilder<bool>()
            .AddRetry(new RetryStrategyOptions<bool>
            {
                MaxRetryAttempts = 2,
                Delay = TimeSpan.FromMilliseconds(100),
                ShouldHandle = new PredicateBuilder<bool>().Handle<RedisException>()
            })
            .AddCircuitBreaker(new CircuitBreakerStrategyOptions<bool>
            {
                FailureRatio = 0.5,
                MinimumThroughput = 5,
                SamplingDuration = TimeSpan.FromSeconds(30),
                BreakDuration = TimeSpan.FromSeconds(15),
                ShouldHandle = new PredicateBuilder<bool>().Handle<RedisException>()
            })
            .Build();

    private static ResiliencePipeline<FleetSummaryResponse> BuildDatabasePipeline() =>
        new ResiliencePipelineBuilder<FleetSummaryResponse>()
            .AddRetry(new RetryStrategyOptions<FleetSummaryResponse>
            {
                MaxRetryAttempts = 2,
                Delay = TimeSpan.FromMilliseconds(150),
                ShouldHandle = new PredicateBuilder<FleetSummaryResponse>()
                    .Handle<Exception>(exception => exception is not OperationCanceledException)
            })
            .AddCircuitBreaker(new CircuitBreakerStrategyOptions<FleetSummaryResponse>
            {
                FailureRatio = 0.5,
                MinimumThroughput = 5,
                SamplingDuration = TimeSpan.FromSeconds(30),
                BreakDuration = TimeSpan.FromSeconds(15),
                ShouldHandle = new PredicateBuilder<FleetSummaryResponse>()
                    .Handle<Exception>(exception => exception is not OperationCanceledException)
            })
            .Build();

    private async Task<FleetSummaryResponse> LoadFromDatabaseAsync(CancellationToken cancellationToken)
    {
        var totalVehicles = await dbContext.Vehicles.AsNoTracking().CountAsync(cancellationToken);
        var activeVehicles = await dbContext.Vehicles
            .AsNoTracking()
            .CountAsync(vehicle => vehicle.Status != VehicleStatus.Offline, cancellationToken);
        var openAlerts = await dbContext.Alerts
            .AsNoTracking()
            .CountAsync(alert => alert.ResolvedAtUtc == null, cancellationToken);
        var recentSpeeds = await dbContext.TelemetryReadings
            .AsNoTracking()
            .Where(reading => reading.ObservedAtUtc >= DateTime.UtcNow.AddMinutes(-5))
            .Select(reading => reading.SpeedKph)
            .ToListAsync(cancellationToken);

        return new FleetSummaryResponse(
            totalVehicles,
            activeVehicles,
            openAlerts,
            recentSpeeds.Count == 0 ? 0 : decimal.Round(recentSpeeds.Average(), 2),
            DateTimeOffset.UtcNow);
    }
}
