using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace OpsDashboard.Infrastructure.Persistence;

public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<OpsDashboardDbContext>
{
    public OpsDashboardDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<OpsDashboardDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=ops_dashboard;Username=ops_dashboard;Password=ops_dashboard")
            .Options;

        return new OpsDashboardDbContext(options);
    }
}
