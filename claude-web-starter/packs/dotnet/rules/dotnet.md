---
paths:
  - "**/*.cs"
  - "**/*.fs"
  - "**/*.csproj"
  - "**/*.fsproj"
  - "**/*.sln"
  - "**/*.slnx"
---
# .NET rules (.NET 8+, C# 12+; ASP.NET Core / EF Core aware)

## Language
- Nullable reference types stay enabled; no `!` null-forgiving operator to silence a warning — check for null or fix the type. No `#pragma warning disable` without a reason on the same line.
- `record` / `record struct` for DTOs and value objects, `sealed` classes by default, `required` and `init` for construction, file-scoped namespaces, primary constructors where the project uses them.
- `async` all the way: no `.Result`, `.Wait()` or `GetAwaiter().GetResult()` on tasks; no `async void` except event handlers. Pass `CancellationToken` through every I/O call.
- `IDisposable`/`IAsyncDisposable` with `using`/`await using`. `HttpClient` only through `IHttpClientFactory` or a typed client, never `new HttpClient()` per call.
- No `Console.WriteLine` logging in apps and services — `ILogger<T>` with structured templates (`logger.LogInformation("Order {OrderId} created", id)`), never string interpolation in log messages.
- No `dynamic`, no reflection tricks where a generic or interface works.

## Errors
- Never swallow: no empty `catch` (a hook flags it), no `catch (Exception) { }` around business logic. Catch specific exceptions; rethrow with `throw;` (never `throw ex;`, which loses the stack).
- Expected failures as result types or specific exceptions; map them to `ProblemDetails` in one place (`IExceptionHandler` / middleware). Never return exception messages or stack traces to clients.

## ASP.NET Core
- Dependency injection through constructors; register lifetimes correctly (no scoped service captured in a singleton). Options pattern (`IOptions<T>` with validation) for config, never `Environment.GetEnvironmentVariable` in business code.
- Endpoints/controllers stay thin: bind request DTO → validate (FluentValidation or DataAnnotations) → service → response DTO. Never expose EF entities. `[Authorize]`/policies on every non-public endpoint.
- Never disable certificate validation (`ServerCertificateCustomValidationCallback = ... => true`; a hook flags it).

## EF Core / data
- `AsNoTracking()` for reads, projection with `Select` to DTOs, `Include` deliberately (watch N+1 and cartesian explosions → `AsSplitQuery`), pagination on every list.
- Raw SQL only through `FromSql`/`ExecuteSql` with interpolated *parameters* (FormattableString) — never `FromSqlRaw` with concatenated input.
- Schema changes through `dotnet ef migrations add`; never edit an applied migration.

## Tests
- xUnit/NUnit/MSTest as the project already uses; `[Theory]` + `[InlineData]`/`[TestCase]` for input tables. `WebApplicationFactory` for API tests; Testcontainers or the project's DB fixture instead of the EF in-memory provider for query behaviour.
- Never skip a failing test (`[Fact(Skip = ...)]`, `[Ignore]`) to get a green run (a hook flags it).

## Tooling (/verify)
`/verify` runs `dotnet build` and `dotnet test`. Run `dotnet format` on the project before finishing when the repo has an `.editorconfig`.
New NuGet packages need the user's approval.
