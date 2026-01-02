import { z } from "zod";
import { defineManifest } from "@accord/manifest";

export const contractMeta = {
  name: "csx-user-card",
  version: "1.0.0",
  contractVersion: "1.0.0",
  tagName: "csx-user-card"
};

export const propsSchema = z.object({
  userId: z.string(),
  readonly: z.boolean().default(false)
});

export const eventsSchema = {
  "user:selected": z.object({
    userId: z.string()
  }),
  "user:deleted": z.object({
    userId: z.string(),
    reason: z.enum(["manual", "policy"])
  })
};

export const capabilities = {
  audit: z.object({
    log: z
      .function()
      .args(
        z.object({
          action: z.string(),
          entity: z.string(),
          metadata: z.record(z.any()).optional()
        })
      )
      .returns(z.void())
  }),
  nav: z.object({
    navigate: z.function().args(z.object({ to: z.string() })).returns(z.void())
  }),
  store: z.object({
    subscribe: z
      .function()
      .args(z.function().args(z.any()).returns(z.void()))
      .returns(z.function().returns(z.void())),
    getSnapshot: z.function().returns(z.any())
  })
};

export const hostRequirements = {
  styling: "no-shadow-dom" as const,
  designTokens: true
};

export const manifest = defineManifest({
  meta: contractMeta,
  props: propsSchema,
  events: eventsSchema,
  capabilities,
  hostRequirements
});
