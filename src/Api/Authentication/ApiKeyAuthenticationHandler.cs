using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;

namespace OpsDashboard.Api.Authentication;

public sealed class ApiKeyAuthenticationOptions : AuthenticationSchemeOptions
{
    public const string DefaultScheme = "ApiKey";
    public string HeaderName { get; set; } = "X-API-Key";
    public string AuthorizationScheme { get; set; } = "ApiKey";
    public string QueryStringName { get; set; } = "api_key";
}

public sealed class ApiKeyAuthenticationHandler(
    IOptionsMonitor<ApiKeyAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<ApiKeyAuthenticationOptions>(options, logger, encoder)
{
    public const string SchemeName = ApiKeyAuthenticationOptions.DefaultScheme;

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var configuration = Context.RequestServices.GetRequiredService<IConfiguration>();
        var expectedKey = configuration.GetValue<string>("ApiKey")
            ?? configuration.GetValue<string>("OPS_API_KEY");

        if (string.IsNullOrWhiteSpace(expectedKey))
        {
            return Task.FromResult(AuthenticateResult.Fail("API key is not configured."));
        }

        var suppliedKey = ExtractSuppliedKey();
        if (string.IsNullOrWhiteSpace(suppliedKey) || !string.Equals(suppliedKey, expectedKey, StringComparison.Ordinal))
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid API key."));
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "api-client"),
            new Claim(ClaimTypes.Name, "api-client")
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }

    private string? ExtractSuppliedKey()
    {
        if (Request.Headers.TryGetValue(Options.HeaderName, out StringValues headerValue) && !StringValues.IsNullOrEmpty(headerValue))
        {
            return headerValue.ToString();
        }

        if (Request.Headers.Authorization.Count > 0)
        {
            var authorization = Request.Headers.Authorization.ToString();
            const string apiKeyPrefix = "ApiKey ";
            if (authorization.StartsWith(apiKeyPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return authorization[apiKeyPrefix.Length..].Trim();
            }

            const string bearerPrefix = "Bearer ";
            if (authorization.StartsWith(bearerPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return authorization[bearerPrefix.Length..].Trim();
            }
        }

        if (Request.Query.TryGetValue(Options.QueryStringName, out StringValues queryValue) && !StringValues.IsNullOrEmpty(queryValue))
        {
            return queryValue.ToString();
        }

        if (Request.Query.TryGetValue("access_token", out StringValues accessTokenValue) && !StringValues.IsNullOrEmpty(accessTokenValue))
        {
            return accessTokenValue.ToString();
        }

        return null;
    }
}
