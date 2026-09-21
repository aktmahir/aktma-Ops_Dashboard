using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpsDashboard.Domain.Entities;

namespace OpsDashboard.Infrastructure.Persistence.Configurations;

public sealed class TelemetryReadingConfiguration : IEntityTypeConfiguration<TelemetryReading>
{
    public void Configure(EntityTypeBuilder<TelemetryReading> builder)
    {
        builder.ToTable("telemetry_readings");
        builder.HasKey(reading => reading.Id);
        builder.Property(reading => reading.SpeedKph).HasPrecision(8, 2);
        builder.Property(reading => reading.FuelPercent).HasPrecision(5, 2);
        builder.Property(reading => reading.EngineTemperatureCelsius).HasPrecision(6, 2);
        builder.HasIndex(reading => new { reading.VehicleId, reading.ObservedAtUtc });
        builder.HasOne(reading => reading.Vehicle)
            .WithMany(vehicle => vehicle.TelemetryReadings)
            .HasForeignKey(reading => reading.VehicleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
