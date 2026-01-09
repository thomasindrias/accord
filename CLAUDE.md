# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies (run from workspace root)
npm install

# Run all tests
npm test

# Build all packages
npm run build

# Lint all packages
npm run lint

# Generate types from local manifest
npm exec accord-types -- --manifest ./src/component.manifest.ts --outDir ./src/generated

# Generate types from remote manifest URL
npm exec accord-types -- --manifestUrl https://cdn.example.com/manifest.json --outDir ./src/generated
```

## Architecture Overview

Accord is a contract-first integration layer for Web Component microfrontends. It enables type-safe mounting of remote custom elements in host applications.

### Monorepo Structure

This is an npm workspace monorepo with three core packages:

- **`packages/@accord/manifest`** - Contract definitions using Zod schemas. Exports `defineManifest()`, `validateManifest()`, `resolveCompatibility()`, and `getManifestJsonSchema()`.

- **`packages/@accord/host`** - Runtime for loading and mounting remote components. Exports `registerRemote()`, `loadRemote()`, and `mount()`. Handles script deduplication, timeout handling, and dev-time prop/event validation.

- **`packages/@accord/types`** - CLI tool (`accord-types`) that generates TypeScript types from manifests. Supports both local `.ts` manifests and remote `manifest.json` URLs.

### Examples

- `examples/lit-remote` - Lit-based remote component demonstrating manifest definition and custom element implementation
- `examples/next-host` - Next.js host application showing how to load and render remote components

### Data Flow

1. Remote defines a manifest with Zod schemas (props, events, capabilities, hostRequirements)
2. Host generates TypeScript types from the manifest using `accord-types`
3. Host mounts the component with `mount()` or renders directly in JSX (React 19)
4. Host passes capabilities through `element.host` property (never window globals)

### Key Design Decisions

- **Zod is the single source of truth** - Runtime validation, TypeScript types, and JSON schema all derive from Zod definitions
- **No SSR for remotes** - Client-side only mounting
- **No bundled build pipeline** - Remotes handle their own builds
- **Host APIs via element property** - Capabilities passed through `element.host`, not global window pollution
- **Semver contract negotiation** - Version compatibility via `semver.satisfies`
- **Attribute-based props** - Strings/booleans as HTML attributes, objects as properties

### Testing

Tests use Vitest with jsdom environment. Test files are colocated with source files using `.test.ts` suffix.
