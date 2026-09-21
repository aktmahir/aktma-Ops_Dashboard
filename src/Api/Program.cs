using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using OpsDashboard.Api;
using OpsDashboard.Api.Authentication;
using OpsDashboard.Api.Realtime;
using OpsDashboard.Application.Abstractions;
using OpsDashboard.Infrastructure.Persistence;
using OpsDashboard.Infrastructure.Services;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(ApiKeyAuthenticationHandler.SchemeName)
    .AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>(
        ApiKeyAuthenticationHandler.SchemeName,
        _ => { });
builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddCors(options => options.AddPolicy("Dashboard", policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
var redisConnection = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
builder.Services.AddDbContext<OpsDashboardDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var options = ConfigurationOptions.Parse(redisConnection);
    options.AbortOnConnectFail = false;
    options.ConnectTimeout = 500;
    options.AsyncTimeout = 500;
    options.SyncTimeout = 500;
    options.ConnectRetry = 1;
    return ConnectionMultiplexer.Connect(options);
});
builder.Services.AddSignalR()
    .AddStackExchangeRedis(options =>
    {
        options.Configuration = ConfigurationOptions.Parse(redisConnection);
        options.Configuration.AbortOnConnectFail = false;
        options.Configuration.ConnectTimeout = 500;
        options.Configuration.AsyncTimeout = 500;
        options.Configuration.SyncTimeout = 500;
        options.Configuration.ConnectRetry = 1;
    });
builder.Services.AddScoped<ITelemetryIngestionService, TelemetryIngestionService>();
builder.Services.AddScoped<IFleetQueryService, FleetQueryService>();
builder.Services.AddScoped<IFleetSummaryService, FleetSummaryService>();
builder.Services.AddScoped<IAlertQueryService, AlertQueryService>();
builder.Services.AddSingleton<ITelemetryUpdatePublisher, SignalRTelemetryUpdatePublisher>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors("Dashboard");
app.UseAuthentication();
app.UseAuthorization();
app.UseSwagger();
app.UseSwaggerUI();
app.MapGet("/health", () => TypedResults.Ok(new { status = "ok" }))
    .WithTags("Health")
    .WithOpenApi();
app.MapHub<FleetHub>("/hubs/fleet");
app.MapFleetEndpoints();

app.Run();

public partial class Program;
