import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineManifest,
  getManifestJsonSchema,
  resolveCompatibility,
  validateManifest
} from "./index";

describe("manifest utilities", () => {
  it("validates a correct manifest", () => {
    const manifest = defineManifest({
      meta: {
        name: "demo",
        version: "1.0.0",
        contractVersion: "1",
        tagName: "demo-element"
      },
      props: z.object({ id: z.string() }),
      events: {
        "demo:ready": z.object({ ready: z.boolean() })
      },
      capabilities: {
        audit: z.object({ log: z.function().args(z.any()).returns(z.void()) })
      }
    });

    const result = validateManifest(manifest);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(getManifestJsonSchema(manifest)).toHaveProperty("meta");
  });

  it("reports invalid sections", () => {
    const manifest = {
      meta: {
        name: "",
        version: "1.0.0",
        contractVersion: "1",
        tagName: "demo-element"
      },
      props: "not-zod",
      events: {
        "demo:ready": "nope"
      }
    };

    const result = validateManifest(manifest as never);

    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toContain("Invalid meta section");
    expect(result.errors.join(" ")).toContain("Props schema must be a Zod schema");
    expect(result.errors.join(" ")).toContain("Event schema for \"demo:ready\" must be a Zod schema");
  });

  it("checks semver compatibility", () => {
    expect(resolveCompatibility("^1.0.0", "1.2.3")).toBe(true);
    expect(resolveCompatibility("^2.0.0", "1.2.3")).toBe(false);
    expect(resolveCompatibility("not-a-range", "1.2.3")).toBe(false);
  });
});
