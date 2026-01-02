import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type GenerateTypesOptions = {
  manifestPath: string;
  outDir: string;
  fileName?: string;
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
`;

export const generateTypes = async ({ manifestPath, outDir, fileName }: GenerateTypesOptions) => {
  const outputFile = fileName ?? "manifest-types.ts";
  const relativeImport = path.relative(outDir, manifestPath).replace(/\\/g, "/");
  const manifestImport = relativeImport.startsWith(".") ? relativeImport : `./${relativeImport}`;

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, outputFile), renderTypesFile(manifestImport));
};
