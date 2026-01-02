import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import semver from "semver";

export const contractMetaSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  contractVersion: z.string().min(1),
  tagName: z.string().min(1)
});

export type ContractMeta = z.infer<typeof contractMetaSchema>;

export const hostRequirementsSchema = z.object({
  styling: z.enum(["shadow-dom", "no-shadow-dom"]).default("no-shadow-dom"),
  designTokens: z.boolean().default(false)
});

export type HostRequirements = z.infer<typeof hostRequirementsSchema>;

export type EventsSchema = Record<string, z.ZodTypeAny>;
export type CapabilitiesSchema = Record<string, z.ZodTypeAny>;

export type Manifest = {
  meta: ContractMeta;
  props: z.ZodTypeAny;
  events: EventsSchema;
  capabilities?: CapabilitiesSchema;
  hostRequirements?: HostRequirements;
};

export type ManifestValidationResult = {
  success: boolean;
  errors: string[];
};

const isZodType = (value: unknown): value is z.ZodTypeAny =>
  typeof value === "object" && value !== null && "_def" in value;

export const defineManifest = <T extends Manifest>(manifest: T): T => manifest;

export const validateManifest = (manifest: Manifest): ManifestValidationResult => {
  const errors: string[] = [];

  const metaResult = contractMetaSchema.safeParse(manifest.meta);
  if (!metaResult.success) {
    errors.push("Invalid meta section", ...metaResult.error.errors.map((issue) => issue.message));
  }

  if (!isZodType(manifest.props)) {
    errors.push("Props schema must be a Zod schema");
  }

  for (const [eventName, schema] of Object.entries(manifest.events ?? {})) {
    if (!isZodType(schema)) {
      errors.push(`Event schema for \"${eventName}\" must be a Zod schema`);
    }
  }

  for (const [capabilityName, schema] of Object.entries(manifest.capabilities ?? {})) {
    if (!isZodType(schema)) {
      errors.push(`Capability schema for \"${capabilityName}\" must be a Zod schema`);
    }
  }

  if (manifest.hostRequirements) {
    const hostResult = hostRequirementsSchema.safeParse(manifest.hostRequirements);
    if (!hostResult.success) {
      errors.push(
        "Invalid hostRequirements section",
        ...hostResult.error.errors.map((issue) => issue.message)
      );
    }
  }

  return {
    success: errors.length === 0,
    errors
  };
};

export const resolveCompatibility = (
  hostContractRange: string,
  componentContractVersion: string
): boolean => {
  const hostRange = semver.validRange(hostContractRange);
  const componentVersion = semver.coerce(componentContractVersion)?.version;

  if (!hostRange || !componentVersion) {
    return false;
  }

  return semver.satisfies(componentVersion, hostRange);
};

export const getManifestJsonSchema = (manifest: Manifest) => {
  return {
    meta: zodToJsonSchema(contractMetaSchema, "Meta"),
    props: zodToJsonSchema(manifest.props, "Props"),
    events: Object.fromEntries(
      Object.entries(manifest.events).map(([eventName, schema]) => [
        eventName,
        zodToJsonSchema(schema, `${eventName}-event`)
      ])
    ),
    capabilities: Object.fromEntries(
      Object.entries(manifest.capabilities ?? {}).map(([capabilityName, schema]) => [
        capabilityName,
        zodToJsonSchema(schema, `${capabilityName}-capability`)
      ])
    ),
    hostRequirements: manifest.hostRequirements
      ? zodToJsonSchema(hostRequirementsSchema, "HostRequirements")
      : null
  };
};
