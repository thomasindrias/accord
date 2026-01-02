# Accord

Accord is a contract-first integration layer for Web Component microfrontends. It provides a small host runtime, a Zod-first manifest definition, and type generation so hosts can safely mount remote components.

## Packages

- `@accord/manifest`: manifest types, validation, JSON schema helpers
- `@accord/host`: runtime host for loading and mounting remote components
- `@accord/types`: type generator CLI for manifest-driven typings

## Quickstart

### 1) Define a contract (remote component)

```ts
import { z } from "zod";
import { defineManifest } from "@accord/manifest";

export const manifest = defineManifest({
  meta: {
    name: "csx-user-card",
    version: "1.0.0",
    contractVersion: "1.0.0",
    tagName: "csx-user-card"
  },
  props: z.object({
    userId: z.string(),
    readonly: z.boolean().default(false)
  }),
  events: {
    "user:selected": z.object({ userId: z.string() })
  },
  capabilities: {
    audit: z.object({
      log: z.function().args(
        z.object({
          action: z.string(),
          entity: z.string(),
          metadata: z.record(z.any()).optional()
        })
      ).returns(z.void())
    })
  },
  hostRequirements: {
    styling: "no-shadow-dom",
    designTokens: true
  }
});
```

### 2) Generate host types

```bash
accord-types --manifest ./src/csx-user-card.manifest.ts --outDir ./src/generated
```

This generates a `manifest-types.ts` file with typed `Props`, `Events`, and `Capabilities`.

### 3) Mount the component in a host

```ts
import { mount, registerRemote } from "@accord/host";

registerRemote({
  id: "csx-user-card",
  url: "https://cdn.example.com/csx-user-card.js",
  integrity: "sha384-..."
});

await mount({
  remoteId: "csx-user-card",
  tagName: "csx-user-card",
  container: document.getElementById("slot")!,
  props: {
    userId: "user-123"
  },
  hostApi: {
    audit: {
      log: (event) => console.log("audit", event)
    }
  },
  onEvent: (eventName, payload) => {
    console.log("event", eventName, payload);
  },
  fallback: "Component failed to load",
  dev: true
});
```

## Examples

- `examples/lit-remote`: Lit-based remote component and manifest
- `examples/next-host`: Next.js host application

## Design Notes

- Zod is the single source of truth for contracts.
- Hosts pass capabilities through the `host` property on custom elements.
- The runtime never uses `window.*` to inject host services.
- The host runtime performs optional dev-time validation of props and event payloads.

## Risks / MVP Limitations

- No SSR support for remote components.
- No bundled build pipeline for remotes.
- Contract version negotiation is limited to `semver.satisfies`.
