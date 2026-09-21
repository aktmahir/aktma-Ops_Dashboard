using System.Net.Http.Json;
using System.Text.Json.Serialization;

var apiUrl = Environment.GetEnvironmentVariable("OPS_API_URL") ?? "http://localhost:5000";
var vehicleCount = ParseBoundedInt(Environment.GetEnvironmentVariable("VEHICLE_COUNT"), 50, 1, 200);
var intervalSeconds = ParseBoundedInt(Environment.GetEnvironmentVariable("INTERVAL_SECONDS"), 2, 1, 30);

using var httpClient = new HttpClient
{
	BaseAddress = new Uri(apiUrl, UriKind.Absolute),
	Timeout = TimeSpan.FromSeconds(10)
};

using var cancellationSource = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
	eventArgs.Cancel = true;
	cancellationSource.Cancel();
};

Console.WriteLine($"Simulating {vehicleCount} vehicles at {apiUrl} every {intervalSeconds}s. Press Ctrl+C to stop.");
var random = new Random(42);
var vehicles = Enumerable.Range(1, vehicleCount)
	.Select(index => new SimulatedVehicle($"VH-{index:000}", $"Vehicle {index:000}", (index % 4) switch
	{
		0 => "North",
		1 => "South",
		2 => "East",
		_ => "West"
	},
	40 + random.NextDouble() * 4,
	-74 + random.NextDouble() * 4))
	.ToArray();

try
{
	while (!cancellationSource.IsCancellationRequested)
	{
		var readings = vehicles.Select(vehicle => vehicle.NextReading(random)).ToArray();
		var response = await httpClient.PostAsJsonAsync(
			"/api/telemetry/batch",
			new TelemetryBatchRequest(readings),
			cancellationSource.Token);

		if (response.IsSuccessStatusCode)
		{
			Console.WriteLine($"{DateTimeOffset.UtcNow:O} posted {readings.Length} readings");
		}
		else
		{
			Console.WriteLine($"{DateTimeOffset.UtcNow:O} API returned {(int)response.StatusCode} {response.ReasonPhrase}");
		}

		await Task.Delay(TimeSpan.FromSeconds(intervalSeconds), cancellationSource.Token);
	}
}
catch (OperationCanceledException) when (cancellationSource.IsCancellationRequested)
{
	Console.WriteLine("Simulator stopped.");
}
catch (HttpRequestException exception)
{
	Console.Error.WriteLine($"Unable to reach API: {exception.Message}");
	Environment.ExitCode = 1;
}

static int ParseBoundedInt(string? value, int fallback, int minimum, int maximum)
{
	return int.TryParse(value, out var parsed)
		? Math.Clamp(parsed, minimum, maximum)
		: fallback;
}

sealed class SimulatedVehicle(string externalId, string name, string region, double latitude, double longitude)
{
	private double currentLatitude = latitude;
	private double currentLongitude = longitude;

	public TelemetryPointRequest NextReading(Random random)
	{
		currentLatitude += (random.NextDouble() - 0.5) * 0.01;
		currentLongitude += (random.NextDouble() - 0.5) * 0.01;
		var speed = (decimal)(random.NextDouble() * 90);
		var fuel = (decimal)Math.Clamp(100 - random.NextDouble() * 85, 5, 100);
		var temperature = 78m + speed * 0.2m + (decimal)random.NextDouble() * 8m;

		return new TelemetryPointRequest(
			externalId,
			name,
			region,
			DateTimeOffset.UtcNow,
			currentLatitude,
			currentLongitude,
			decimal.Round(speed, 2),
			decimal.Round(fuel, 2),
			decimal.Round(temperature, 2));
	}
}

sealed record TelemetryBatchRequest(
	[property: JsonPropertyName("readings")] IReadOnlyList<TelemetryPointRequest> Readings);

sealed record TelemetryPointRequest(
	[property: JsonPropertyName("vehicleExternalId")] string VehicleExternalId,
	[property: JsonPropertyName("vehicleName")] string VehicleName,
	[property: JsonPropertyName("region")] string Region,
	[property: JsonPropertyName("observedAt")] DateTimeOffset ObservedAt,
	[property: JsonPropertyName("latitude")] double Latitude,
	[property: JsonPropertyName("longitude")] double Longitude,
	[property: JsonPropertyName("speedKph")] decimal SpeedKph,
	[property: JsonPropertyName("fuelPercent")] decimal FuelPercent,
	[property: JsonPropertyName("engineTemperatureCelsius")] decimal EngineTemperatureCelsius);
