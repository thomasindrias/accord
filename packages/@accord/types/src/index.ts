import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  nullable?: boolean;
  $ref?: string;
  definitions?: Record<string, JsonSchema>;
  $defs?: Record<string, JsonSchema>;
  description?: string;
};

type ManifestMeta = {
  name: string;
  version: string;
  contractVersion: string;
  tagName: string;
};

export type ManifestJsonPayload = {
  meta: ManifestMeta | JsonSchema;
  props: JsonSchema;
  events: Record<string, JsonSchema>;
  capabilities?: Record<string, JsonSchema>;
  hostRequirements?: JsonSchema | null;
};

export type GenerateTypesOptions = {
  manifestPath?: string;
  manifestUrl?: string;
  outDir: string;
  fileName?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isManifestMeta = (value: unknown): value is ManifestMeta =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.version === "string" &&
  typeof value.contractVersion === "string" &&
  typeof value.tagName === "string";

const isManifestJsonPayload = (value: unknown): value is ManifestJsonPayload =>
  isRecord(value) &&
  "meta" in value &&
  "props" in value &&
  "events" in value &&
  isRecord(value.events as unknown);

const extractDefinitions = (schema: JsonSchema): Record<string, JsonSchema> =>
  schema.definitions ?? schema.$defs ?? {};

const resolveRefName = (ref: string): string | null => {
  const match = ref.match(/^#\/(definitions|\$defs)\/(.+)$/u);
  return match ? match[2] : null;
};

const literalType = (value: unknown) => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "unknown";
};

const schemaToType = (
  schema: JsonSchema,
  definitions: Record<string, JsonSchema>,
  visited: Set<string> = new Set()
): string => {
  if (schema.$ref) {
    const refName = resolveRefName(schema.$ref);
    if (!refName) {
      return "unknown";
    }
    if (visited.has(refName)) {
      return "unknown";
    }
    const resolved = definitions[refName];
    if (!resolved) {
      return "unknown";
    }
    visited.add(refName);
    return schemaToType(resolved, definitions, visited);
  }

  if (schema.const !== undefined) {
    return literalType(schema.const);
  }

  if (schema.enum) {
    const literals = schema.enum.map((value) => literalType(value)).join(" | ");
    return literals.length > 0 ? literals : "unknown";
  }

  if (schema.oneOf || schema.anyOf) {
    const unionSchemas = schema.oneOf ?? schema.anyOf ?? [];
    return unionSchemas.map((entry) => schemaToType(entry, definitions)).join(" | ");
  }

  if (schema.allOf) {
    return schema.allOf.map((entry) => schemaToType(entry, definitions)).join(" & ");
  }

  const schemaType = schema.type;
  if (Array.isArray(schemaType)) {
    const types = schemaType.map((typeName) =>
      schemaToType({ ...schema, type: typeName }, definitions)
    );
    return types.join(" | ");
  }

  let resolvedType: string;
  switch (schemaType) {
    case "string":
      resolvedType = "string";
      break;
    case "number":
    case "integer":
      resolvedType = "number";
      break;
    case "boolean":
      resolvedType = "boolean";
      break;
    case "null":
      resolvedType = "null";
      break;
    case "array": {
      const items = schema.items;
      if (Array.isArray(items)) {
        const tuple = items.map((entry) => schemaToType(entry, definitions)).join(", ");
        resolvedType = `[${tuple}]`;
      } else if (items) {
        resolvedType = `Array<${schemaToType(items, definitions)}>`;
      } else {
        resolvedType = "unknown[]";
      }
      break;
    }
    case "object":
    default: {
      const properties = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const lines = Object.entries(properties).map(([key, value]) => {
        const optionalFlag = required.has(key) ? "" : "?";
        const propType = schemaToType(value, definitions);
        return `${JSON.stringify(key)}${optionalFlag}: ${propType};`;
      });
      if (schema.additionalProperties) {
        const additionalType =
          typeof schema.additionalProperties === "boolean"
            ? "unknown"
            : schemaToType(schema.additionalProperties, definitions);
        lines.push(`[key: string]: ${additionalType};`);
      }
      resolvedType = lines.length ? `{\n  ${lines.join("\n  ")}\n}` : "{ }";
      break;
    }
  }

  if (schema.nullable && resolvedType !== "null") {
    return `${resolvedType} | null`;
  }

  return resolvedType;
};

const resolveTagName = (meta: ManifestJsonPayload["meta"]): string | undefined => {
  if (isManifestMeta(meta)) {
    return meta.tagName;
  }
  if (isRecord(meta)) {
    const tagSchema = (meta as JsonSchema).properties?.tagName;
    if (tagSchema?.const !== undefined) {
      return String(tagSchema.const);
    }
    if (tagSchema?.enum?.length === 1) {
      return String(tagSchema.enum[0]);
    }
    if (typeof tagSchema?.default === "string") {
      return tagSchema.default;
    }
  }
  return undefined;
};

const renderTypesFile = (manifestImportPath: string) => `import { z } from "zod";
import { manifest } from "${manifestImportPath}";

export type Props = z.infer<typeof manifest.props>;

export type Events = {
  [K in keyof typeof manifest.events]: z.infer<(typeof manifest.events)[K]>;
};

export type Capabilities = typeof manifest.capabilities extends undefined
  ? Record<string, never>
  : {
      [K in keyof typeof manifest.capabilities]: z.infer<(typeof manifest.capabilities)[K]>;
    };

export type TagName = typeof manifest.meta.tagName;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [K in TagName]: Props;
    }
  }
}
`;

const renderManifestJsonTypesFile = (manifest: ManifestJsonPayload) => {
  const tagName = resolveTagName(manifest.meta);
  const tagNameType = tagName ? JSON.stringify(tagName) : "string";
  const propsType = schemaToType(manifest.props, extractDefinitions(manifest.props));

  const eventsEntries = Object.entries(manifest.events ?? {});
  const eventsType =
    eventsEntries.length > 0
      ? `{\n  ${eventsEntries
          .map(([eventName, schema]) => {
            const eventType = schemaToType(schema, extractDefinitions(schema));
            return `${JSON.stringify(eventName)}: ${eventType};`;
          })
          .join("\n  ")}\n}`
      : "Record<string, never>";

  const capabilityEntries = Object.entries(manifest.capabilities ?? {});
  const capabilitiesType =
    capabilityEntries.length > 0
      ? `{\n  ${capabilityEntries
          .map(([capabilityName, schema]) => {
            const capabilityType = schemaToType(schema, extractDefinitions(schema));
            return `${JSON.stringify(capabilityName)}: ${capabilityType};`;
          })
          .join("\n  ")}\n}`
      : "Record<string, never>";

  return `export type Props = ${propsType};

export type Events = ${eventsType};

export type Capabilities = ${capabilitiesType};

export type TagName = ${tagNameType};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [K in TagName]: Props;
    }
  }
}
`;
};

export const generateTypes = async ({
  manifestPath,
  manifestUrl,
  outDir,
  fileName
}: GenerateTypesOptions) => {
  const outputFile =
    fileName ?? (manifestUrl ? "manifest-types.d.ts" : "manifest-types.ts");

  await mkdir(outDir, { recursive: true });

  if (manifestPath && manifestUrl) {
    throw new Error("Provide either manifestPath or manifestUrl, not both.");
  }

  if (manifestUrl) {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest from ${manifestUrl}: ${response.statusText}`);
    }
    const manifestJson = (await response.json()) as unknown;
    if (!isManifestJsonPayload(manifestJson)) {
      throw new Error("Manifest JSON is missing required sections (meta, props, events).");
    }

    await writeFile(path.join(outDir, outputFile), renderManifestJsonTypesFile(manifestJson));
    return;
  }

  if (!manifestPath) {
    throw new Error("manifestPath is required when manifestUrl is not provided.");
  }

  const relativeImport = path.relative(outDir, manifestPath).replace(/\\/g, "/");
  const manifestImport = relativeImport.startsWith(".") ? relativeImport : `./${relativeImport}`;
  const manifestImportPath = manifestImport.replace(/\.(ts|tsx|js|jsx)$/u, "");

  await writeFile(path.join(outDir, outputFile), renderTypesFile(manifestImportPath));
};
