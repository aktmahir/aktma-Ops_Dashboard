using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpsDashboard.Domain.Entities;

namespace OpsDashboard.Infrastructure.Persistence.Configurations;

public sealed class AlertConfiguration : IEntityTypeConfiguration<Alert>
{
    public void Configure(EntityTypeBuilder<Alert> builder)
    {
        builder.ToTable("alerts");
        builder.HasKey(alert => alert.Id);
        builder.Property(alert => alert.Code).HasMaxLength(64).IsRequired();
        builder.Property(alert => alert.Message).HasMaxLength(512).IsRequired();
        builder.HasIndex(alert => new { alert.VehicleId, alert.TriggeredAtUtc });
        builder.HasIndex(alert => new { alert.ResolvedAtUtc, alert.Severity });
        builder.HasOne(alert => alert.Vehicle)
            .WithMany(vehicle => vehicle.Alerts)
            .HasForeignKey(alert => alert.VehicleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
