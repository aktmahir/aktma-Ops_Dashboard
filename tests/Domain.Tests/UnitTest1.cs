using OpsDashboard.Domain.Entities;
using OpsDashboard.Domain.Enums;

namespace OpsDashboard.Domain.Tests;

public sealed class VehicleTests
{
    [Fact]
    public void TelemetryAboveOneKphSetsMovingStatus()
    {
        var vehicle = new Vehicle("VH-001", "Vehicle 001", "North");

        vehicle.ApplyTelemetry(2m);

        Assert.Equal(VehicleStatus.Moving, vehicle.Status);
    }

    [Fact]
    public void TelemetryAtOrBelowOneKphSetsIdleStatus()
    {
        var vehicle = new Vehicle("VH-001", "Vehicle 001", "North");

        vehicle.ApplyTelemetry(1m);

        Assert.Equal(VehicleStatus.Idle, vehicle.Status);
    }
}