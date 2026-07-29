// @vitest-environment node

import { describe, expect, it } from "vitest";
import { build } from "vite";

const EDITOR_MODEL =
  "/src/components/constrained-rich-text-editor/model.ts";
const EDITOR_STATE =
  "/src/components/constrained-rich-text-editor/editing-state.ts";
const EDITOR_STYLES =
  "/src/components/constrained-rich-text-editor/ConstrainedRichTextEditor.module.css";

interface BundleChunk {
  type: "chunk";
  fileName: string;
  isDynamicEntry: boolean;
  isEntry: boolean;
  modules: Record<string, unknown>;
}

interface BundleAsset {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
}

type BundleOutput = BundleChunk | BundleAsset;

interface BundleResult {
  output: BundleOutput[];
}

interface ManifestEntry {
  css?: string[];
  file: string;
  isDynamicEntry?: boolean;
  isEntry?: boolean;
  src?: string;
}

describe("constrained rich-text lazy bundle boundary", () => {
  it("keeps the editor model, editing state, and full CSS out of the shell", async () => {
    const virtualEntry = "virtual:feedback-editor-shell";
    const result = await build({
      root: process.cwd(),
      logLevel: "silent",
      plugins: [
        {
          name: "feedback-editor-shell-entry",
          resolveId(id) {
            return id === virtualEntry ? `\0${virtualEntry}` : undefined;
          },
          load(id) {
            return id === `\0${virtualEntry}`
              ? 'import { ConstrainedRichTextEditor } from "./src/index.ts"; globalThis.__feedbackEditorBundleTest = ConstrainedRichTextEditor;'
              : undefined;
          },
        },
      ],
      build: {
        cssCodeSplit: true,
        manifest: true,
        minify: false,
        rollupOptions: {
          external: [
            "@plasius/analytics",
            "@plasius/translations",
            "react",
            "react/jsx-runtime",
          ],
          input: virtualEntry,
        },
        write: false,
      },
    });
    const buildResults = (Array.isArray(result) ? result : [result]) as unknown as
      BundleResult[];
    const outputs = buildResults.flatMap((buildResult) => buildResult.output);
    const chunks = outputs.filter(
      (output): output is BundleChunk => output.type === "chunk",
    );
    const entryChunk = chunks.find((chunk) => chunk.isEntry);
    const implementationChunk = chunks.find((chunk) =>
      Object.keys(chunk.modules).some((moduleId) =>
        moduleId.endsWith(
          "/src/components/constrained-rich-text-editor/ConstrainedRichTextEditor.tsx",
        ),
      ),
    );

    expect(entryChunk).toBeTruthy();
    expect(implementationChunk?.isDynamicEntry).toBe(true);
    expect(
      Object.keys(entryChunk?.modules ?? {}).some(
        (moduleId) =>
          moduleId.endsWith(EDITOR_MODEL) ||
          moduleId.endsWith(EDITOR_STATE) ||
          moduleId.endsWith(EDITOR_STYLES),
      ),
    ).toBe(false);
    expect(
      Object.keys(implementationChunk?.modules ?? {}).some((moduleId) =>
        moduleId.endsWith(EDITOR_MODEL),
      ),
    ).toBe(true);
    expect(
      Object.keys(implementationChunk?.modules ?? {}).some((moduleId) =>
        moduleId.endsWith(EDITOR_STATE),
      ),
    ).toBe(true);
    expect(
      Object.keys(implementationChunk?.modules ?? {}).some((moduleId) =>
        moduleId.endsWith(EDITOR_STYLES),
      ),
    ).toBe(true);

    const manifestAsset = outputs.find(
      (output): output is BundleAsset =>
        output.type === "asset" &&
        output.fileName.endsWith("manifest.json"),
    );
    expect(manifestAsset).toBeTruthy();
    const manifest = JSON.parse(
      String(manifestAsset?.source ?? "{}"),
    ) as Record<string, ManifestEntry>;
    const entryMetadata = Object.values(manifest).find(
      (metadata) => metadata.isEntry,
    );
    const implementationMetadata = Object.values(manifest).find(
      (metadata) =>
        metadata.isDynamicEntry &&
        metadata.src?.endsWith(
          "constrained-rich-text-editor/ConstrainedRichTextEditor.tsx",
        ),
    );

    expect(entryMetadata).toBeTruthy();
    expect(implementationMetadata?.css).toHaveLength(1);
    expect(entryMetadata?.css ?? []).not.toContain(
      implementationMetadata?.css?.[0],
    );
  });
});
