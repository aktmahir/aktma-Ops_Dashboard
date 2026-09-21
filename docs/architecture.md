# Architecture

```mermaid
flowchart TB
    subgraph Clients
      Dashboard[React + TypeScript dashboard]
      Simulator[.NET telemetry simulator]
    end
    subgraph API[.NET 8 API]
      Controllers[REST controllers]
      Application[Application services]
      Hub[SignalR hub]
      Policies[Polly resilience policies]
    end
    subgraph Data
      PostgreSQL[(PostgreSQL)]
      Redis[(Redis cache and SignalR backplane)]
    end
    Simulator --> Controllers
    Dashboard --> Controllers
    Controllers --> Application
    Application --> Policies
    Policies --> PostgreSQL
    Policies --> Redis
    Application --> Hub
    Hub --> Dashboard
```

The first implementation slice currently contains the Domain and Infrastructure portions of this design. The remaining boxes are introduced in the order documented in the root README.