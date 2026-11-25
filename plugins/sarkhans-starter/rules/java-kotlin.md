---
paths:
  - "**/*.java"
  - "**/*.kt"
  - "**/*.kts"
  - "**/pom.xml"
  - "**/build.gradle"
  - "**/build.gradle.kts"
---
# Java / Kotlin rules (Java 17+, Kotlin 1.9+; Spring Boot / Ktor / Android aware)

## Language
- Follow the existing package layout; package by feature, not by layer type. Keep classes small with one responsibility.
- Java: `record` for DTOs and value objects, `sealed` interfaces + `switch` pattern matching for closed hierarchies, `final` fields, `Optional` only as a return type (never for fields or parameters), `var` only when the type is obvious.
- Kotlin: `val` over `var`, `data class` for values, `sealed` classes for states and results. No `!!` — handle null with `?.`, `?:`, `requireNotNull(x) { "reason" }` or a smart cast. No `lateinit` in place of constructor injection.
- Equality: Java `.equals()`/`Objects.equals()` for objects, never `==` on strings or boxed numbers. Kotlin `==` is structural (fine); `===` only for identity.
- No `System.out`/`System.err`/`println` logging and no `e.printStackTrace()` — use SLF4J (`LoggerFactory.getLogger`) or the project's logger. A hook flags `printStackTrace`.
- Immutable collections in public APIs (`List.copyOf`, Kotlin `List`, not `MutableList`).

## Errors
- Never swallow: no empty `catch` (a hook flags it), no `catch (Exception e) { log; }` that hides the failure. Catch the narrowest type, rethrow with context (`throw new OrderException("create order " + id, e)`).
- Domain errors as specific exception types (Java) or sealed result types (Kotlin); map them to HTTP responses in one place (`@RestControllerAdvice`, Ktor `StatusPages`). Never return stack traces to clients.
- Kotlin coroutines: never catch `CancellationException` without rethrowing it; no `GlobalScope`; use structured concurrency (`coroutineScope`, `viewModelScope`, `lifecycleScope`).

## Spring / server
- Constructor injection only (no `@Autowired` on fields). Controllers stay thin: `@Valid` request DTO → service → response DTO; never expose JPA entities in the API.
- `@Transactional` on service methods that write several rows, not on controllers. Watch N+1: fetch joins / `@EntityGraph`, pagination with `Pageable`, never `findAll()` on big tables.
- Queries with parameters only (`@Query` with `:name`, Criteria, jOOQ). Never concatenate input into JPQL/SQL.
- Schema changes through the project's migration tool (Flyway/Liquibase), never `ddl-auto=update` outside local dev.
- Config via `@ConfigurationProperties` classes, not scattered `@Value`/`System.getenv`. Timeouts on every `RestClient`/`WebClient`/`HttpClient`.

## Android (when present)
- UI state in `ViewModel` exposed as `StateFlow`; no business logic in Activities/Fragments/Composables. No network or disk work on the main thread.
- Compose: state hoisting, `remember`/`rememberSaveable` correctly, stable parameters; strings in `strings.xml`, never hardcoded in UI.

## Tests
- JUnit 5 (+ AssertJ/Kotest/MockK/Mockito, whatever the project uses). `@ParameterizedTest` for input tables. Spring slices (`@WebMvcTest`, `@DataJpaTest`) over full `@SpringBootTest` where they suffice; Testcontainers for real databases if the project has it.
- Never `@Disabled`/`@Ignore` a failing test to get a green run (a hook flags it).

## Tooling (/sarkhans-starter:verify)
`/sarkhans-starter:verify` runs `./mvnw -q -B verify` (Maven) or `./gradlew build` (Gradle), using the wrapper when the project has one. Kotlin files are formatted on edit with `ktlint` when it is installed and the project's `.editorconfig` configures it.
New dependencies in `pom.xml`/`build.gradle(.kts)` need the user's approval.
