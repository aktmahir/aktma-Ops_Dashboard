using System.ComponentModel.DataAnnotations;
using OpsDashboard.Domain.Enums;

namespace OpsDashboard.Application.Telemetry;

/// <summary>A single observed vehicle telemetry point.</summary>
public sealed record TelemetryPointRequest
{
    [Required, MaxLength(64)]
    public required string VehicleExternalId { get; init; }

    [Required, MaxLength(64)]
    public required string VehicleName { get; init; }

    [Required, MaxLength(64)]
    public required string Region { get; init; }

    public required DateTimeOffset ObservedAt { get; init; }
    public required double Latitude { get; init; }
    public required double Longitude { get; init; }

    [Range(0, 250)]
    public required decimal SpeedKph { get; init; }

    [Range(0, 100)]
    public required decimal FuelPercent { get; init; }

    [Range(-50, 200)]
    public required decimal EngineTemperatureCelsius { get; init; }
}

/// <summary>A batch of telemetry points accepted for ingestion.</summary>
public sealed record TelemetryBatchRequest
{
    [Required, MinLength(1), MaxLength(1000)]
    public required IReadOnlyList<TelemetryPointRequest> Readings { get; init; }
}

/// <summary>Result of a telemetry ingestion operation.</summary>
public sealed record TelemetryBatchResponse(int Accepted, DateTimeOffset ProcessedAt);

/// <summary>Current status and latest known telemetry for one vehicle.</summary>
public sealed record VehicleStatusResponse(
    Guid VehicleId,
    string ExternalId,
    string Name,
    string Region,
    VehicleStatus Status,
    DateTimeOffset? ObservedAt,
    double? Latitude,
    double? Longitude,
    decimal? SpeedKph,
    decimal? FuelPercent,
    decimal? EngineTemperatureCelsius);

/// <summary>Historical telemetry and alerts for one vehicle.</summary>
public sealed record VehicleDetailResponse(
    VehicleStatusResponse CurrentStatus,
    IReadOnlyList<TelemetryHistoryResponse> History,
    IReadOnlyList<AlertResponse> Alerts);

/// <summary>A telemetry point in a vehicle history response.</summary>
public sealed record TelemetryHistoryResponse(
    DateTimeOffset ObservedAt,
    double Latitude,
    double Longitude,
    decimal SpeedKph,
    decimal FuelPercent,
    decimal EngineTemperatureCelsius);

/// <summary>An alert in a vehicle detail response.</summary>
public sealed record AlertResponse(
    Guid Id,
    string Code,
    string Message,
    AlertSeverity Severity,
    DateTimeOffset TriggeredAt,
    DateTimeOffset? ResolvedAt);
