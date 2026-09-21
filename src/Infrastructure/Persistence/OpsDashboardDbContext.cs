using Microsoft.EntityFrameworkCore;
using OpsDashboard.Domain.Entities;

namespace OpsDashboard.Infrastructure.Persistence;

public sealed class OpsDashboardDbContext(DbContextOptions<OpsDashboardDbContext> options) : DbContext(options)
{
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<TelemetryReading> TelemetryReadings => Set<TelemetryReading>();
    public DbSet<Alert> Alerts => Set<Alert>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OpsDashboardDbContext).Assembly);
    }
}
