using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpsDashboard.Domain.Entities;

namespace OpsDashboard.Infrastructure.Persistence.Configurations;

public sealed class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> builder)
    {
        builder.ToTable("vehicles");
        builder.HasKey(vehicle => vehicle.Id);
        builder.Property(vehicle => vehicle.ExternalId).HasMaxLength(64).IsRequired();
        builder.Property(vehicle => vehicle.Name).HasMaxLength(128).IsRequired();
        builder.Property(vehicle => vehicle.Region).HasMaxLength(64).IsRequired();
        builder.HasIndex(vehicle => vehicle.ExternalId).IsUnique();
        builder.HasIndex(vehicle => new { vehicle.Region, vehicle.Status });
    }
}
