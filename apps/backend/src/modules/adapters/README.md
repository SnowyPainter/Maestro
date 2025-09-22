# Adapter Module Overview

This package contains everything that turns Maestro IR into platform-specific API calls. In 2024 Q2 we reorganised the code into coherent subpackages so new adapters are easier to reason about and reuse more infrastructure.

## Directory layout

```
core/
  adapter.py        # CapabilityAdapter façade + support reporting
  capabilities.py   # Protocols for compile/publish/delete/metrics/comments
  compiler.py       # SpecCompiler wrapper around compile engine specs
  types.py          # Shared dataclasses, TypedDicts, adapter Protocol
engine.py           # IR → rendered blocks helpers built on compile specs
http/
  graph.py          # Reusable Graph-style transport & error wrappers
impls/
  Threads.py        # Threads adapter using capability composition
  Instagram.py      # Instagram adapter (placeholder publish/metrics)
platforms.py        # Block extraction & platform-level compile helpers
registry.py         # Adapter discovery/registry (auto-imports impls)
service.py          # High level `compile_variant` helper used by flows
```

OAuth providers live next door under `apps/backend/src/services/oauth/` (see below).

## How adapters execute

1. **Injection & compile** – `compile_variant` builds an `InjectedContent` via injectors, then calls `CapabilityAdapter.compile`.  Most adapters use `SpecCompiler`, which wraps `get_compile_spec`/`compile_with_spec` and is parameterised with per-platform hooks.
2. **Capability composition** – `CapabilityAdapter` delegates to capability objects for publish/delete/metrics/comment operations.  Platforms only implement the interfaces they actually support (e.g. Instagram lacks delete/comment support so the base class returns “not supported”).
3. **Transport helpers** – shared HTTP logic (signing, error parsing, JSON validation) lives in `http/graph.py`.  Adapters build thin API clients on top of this transport so credentials and error handling stay consistent.
4. **Metrics normalisation** – capabilities should emit KPI-aligned keys defined in `modules/insights/schemas.py` (`KPIKey`).  Threads, for example, maps Graph metrics like `likes`, `replies`, `reposts` to `KPIKey.LIKES`, `KPIKey.COMMENTS`, `KPIKey.SHARES` and sets an explicit `mapping_version`.
5. **Registry and discovery** – every adapter class exposes a `platform` attribute (`PlatformKind`).  `registry.py` autodiscovers modules under `impls/` and registers them with `ADAPTER_REGISTRY`, making them available to application flows without manual wiring.

## OAuth providers

Adapters obtain refreshed tokens via providers in `apps/backend/src/services/oauth/`:

- `oauth/base.py` defines `BaseOAuthProvider`, `OAuthAccessToken`, `OAuthProfile`, and `OAuthProviderConfig`.
- Each platform-specific provider (e.g. `oauth_threads.py`) subclasses the base, injects its endpoints/default scopes, and implements `_parse_profile_payload` (and optionally `_profile_params`).
- Adapter capabilities accept raw credential mappings; resolver classes (see `ThreadsCredentialResolver`) validate the shape and surface missing-field errors.  The surrounding flow (e.g. `auth_router`) exchanges OAuth codes and persists credentials before invoking adapters.

When introducing a new platform, create its OAuth provider alongside the adapter so publish/delete calls can reuse the same token plumbing and scope constants.

## Adding a new adapter

1. **Identify platform requirements** – decide which capabilities are needed (`PublishingCapability`, `MetricsCapability`, `CommentCreateCapability`, etc.).  If the platform supports comments, implement both create and delete halves separately.
2. **Build capability classes** – write one class per concern (publish, metrics, comments, …).  Each should:
   - accept shared context objects (HTTP transport, credential resolver, configuration);
   - convert Maestro payloads into platform payloads;
   - handle error translation and produce `*Result` dataclasses from `core/types.py`.
3. **Reuse transports** – if the platform exposes a Graph-like API, extend `http/graph.py`; otherwise, add a purpose-built transport under `http/` to keep error/JSON handling consistent.
4. **Metrics mapping** – ensure numbers reported align with `KPIKey` values and bump `mapping_version` whenever the mapping changes.
5. **Compose the adapter** – create `impls/<Platform>.py` that instantiates your capability objects and passes them to `CapabilityAdapter`.  Set `platform = PlatformKind.<NAME>` and (optionally) override `compiler_version`.
6. **Autodiscovery** – simply importing the module under `impls/` is enough; the registry will automatically register the adapter on startup.
7. **OAuth (optional)** – if the platform needs OAuth, add a provider under `services/oauth/`, inheriting from `BaseOAuthProvider`.  Reference it from your flows (see `auth_router.py` for Threads) and ensure capability credential resolvers expect the same fields.
8. **Tests & docs** – add unit/integration tests per capability and update this README if you introduce new shared utilities or capabilities.

## Consuming adapters

- **Compile** – use `compile_variant` (preferred).  It resolves injectors, instantiates the adapter from `ADAPTER_REGISTRY`, and calls `compile`.
- **Direct publish/metrics** – instantiate an adapter manually (`ThreadsAdapter()`), then call `publish`, `sync_metrics`, `create_comment`, etc.  Each method returns a result dataclass with `ok`, `errors`, `warnings`, and (when relevant) `external_id`.
- **Capability awareness** – call `adapter.supports()` to check which operations are available before invoking comment or delete APIs.  The base adapter will respond with “not supported” errors when a capability is absent.

## Naming conventions

- Core abstractions belong in `core/` (protocols, dataclasses, shared base classes).
- API client helpers belong in `http/`.
- Platform-specific behaviour belongs in `impls/` with one file per platform.
- Utility modules that pre-process IR for multiple platforms stay in `platforms.py`.

Following this structure keeps platform integrations isolated while reusing as much infrastructure as possible across Threads, Instagram, and future targets (X, LinkedIn, …).
