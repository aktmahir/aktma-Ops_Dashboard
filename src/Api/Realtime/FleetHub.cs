using Microsoft.AspNetCore.SignalR;

namespace OpsDashboard.Api.Realtime;

public sealed class FleetHub : Hub
{
    public static string RegionGroup(string region) => $"region:{region.Trim().ToLowerInvariant()}";

    public Task SubscribeRegion(string region)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, RegionGroup(region));
    }

    public Task UnsubscribeRegion(string region)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, RegionGroup(region));
    }
}
