import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repo = process.cwd();
const manifest = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
const roots: string[] = [];
const stylesheets: string[] = [
  "components/action-menu/ActionMenu.module.css",
  "components/collection-viewport/CollectionViewport.module.css",
  "components/confirmation-dialog/ConfirmationDialog.module.css",
  "components/constrained-rich-text-editor/ConstrainedRichTextEditor.module.css",
  "components/context-menu/contextMenu.module.css",
  "components/footer/Footer.module.css",
  "components/header/Header.module.css",
  "components/review-sheet/ReviewSheet.module.css",
  "components/star-rating/StarRating.module.css",
  "components/status-panel/StatusPanel.module.css",
  "components/user-profile/UserProfile.module.css"
];
const css = ".sharedcomponents { color: rebeccapurple; }\n";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sharedcomponents-assets-"));
  roots.push(root);
  for (const dir of ["scripts", "node_modules/.bin", ...stylesheets.flatMap((file) => ["src", "dist", "dist-cjs"].map((dir) => join(dir, file, "..")))]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(join(root, "package.json"), JSON.stringify({
    name: "sharedcomponents-build-fixture", version: "1.0.0", scripts: manifest.scripts,
    files: ["dist", "dist-cjs"],
  }));
  for (const file of ["write-cjs-package-json.cjs", "copy-css-assets.cjs"]) {
    try { writeFileSync(join(root, "scripts", file), readFileSync(join(repo, "scripts", file))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  writeFileSync(join(root, "node_modules/.bin/tsc"), "#!/usr/bin/env node\nprocess.exit(Number(process.env.FIXTURE_TSC_EXIT || 0));\n", { mode: 0o755 });
  for (const file of stylesheets) writeFileSync(join(root, "src", file), css);
  writeFileSync(join(root, "dist/index.js"), "export {};\n");
  writeFileSync(join(root, "dist-cjs/package.json"), '{"type":"commonjs"}');
  return root;
}
function build(root: string, env: Record<string, string> = {}) {
  return spawnSync("npm", ["run", "build"], { cwd: root, env: { ...process.env, ...env }, encoding: "utf8", timeout: 30_000 });
}
function pack(root: string) {
  return spawnSync(process.execPath, [resolve(repo, "scripts/verify-public-package.cjs")], { cwd: root, encoding: "utf8", timeout: 30_000 });
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("build asset failure propagation", () => {
  it.each(stylesheets)("fails for missing %s even with stale outputs", (missing) => {
    const root = fixture();
    rmSync(join(root, "src", missing));
    for (const dir of ["dist", "dist-cjs"]) for (const file of stylesheets) writeFileSync(join(root, dir, file), css);
    const result = build(root);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });
  it.each(["dist", "dist-cjs"])("fails when CSS cannot be written to %s", (output) => {
    const root = fixture();
    mkdirSync(join(root, output, "components/action-menu/ActionMenu.module.css"));
    const result = build(root);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });
  it("does not mask a TypeScript compilation failure", () => {
    const result = build(fixture(), { FIXTURE_TSC_EXIT: "23" });
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });
  it("copies the same CSS bytes into both output formats and preserves CJS metadata", () => {
    const root = fixture();
    const result = build(root);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    for (const dir of ["dist", "dist-cjs"]) for (const file of stylesheets) expect(readFileSync(join(root, dir, file), "utf8")).toBe(css);
    expect(JSON.parse(readFileSync(join(root, "dist-cjs/package.json"), "utf8")).type).toBe("commonjs");
  });
});

describe("packed runtime CSS admission", () => {
  it.each(stylesheets.flatMap((file) => ["dist", "dist-cjs"].map((dir) => [dir, file])))("rejects missing packed %s/%s", (missing, file) => {
    const root = fixture();
    for (const dir of ["dist", "dist-cjs"]) for (const asset of stylesheets) if (dir !== missing || asset !== file) writeFileSync(join(root, dir, asset), css);
    const result = pack(root);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`${missing}/${file}`);
  });
  it("rejects CSS omitted by the package file list even when present on disk", () => {
    const root = fixture();
    for (const dir of ["dist", "dist-cjs"]) for (const file of stylesheets) writeFileSync(join(root, dir, file), css);
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "sharedcomponents-build-fixture", version: "1.0.0", files: ["dist/index.js", "dist-cjs/package.json"] }));
    const result = pack(root);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("dist/components/action-menu/ActionMenu.module.css");
  });
});
