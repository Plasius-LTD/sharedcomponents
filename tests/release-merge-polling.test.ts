import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "vitest";

const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/release-prepare.yml"), "utf8",
);
// Execute the actual workflow block, including the initial merge attempt.
const start = workflow.indexOf('            if gh pr merge "${PR_NUMBER}"');
const end = workflow.indexOf('\n          fi\n\n          git fetch', start);
assert.ok(start >= 0 && end > start, "release merge block must be present");
const block = workflow.slice(start, end);

function runScenario(states: string[], { mergeExit = 0, timeout = 10 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "sharedcomponents-release-merge-"));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const statePath = join(dir, "state.json");
  writeFileSync(statePath, JSON.stringify({ states, reads: 0, merges: 0 }));
  writeFileSync(join(dir, "gh"), `#!${process.execPath}
const fs = require("node:fs");
const p = process.env.MOCK_STATE;
const s = JSON.parse(fs.readFileSync(p, "utf8"));
const command = process.argv[3];
let exit = 0;
if (command === "view") {
  const state = s.states[Math.min(s.reads++, s.states.length - 1)];
  if (state === "API_ERROR") exit = 1;
  else console.log(state);
} else if (command === "merge") {
  s.merges++;
  exit = Number(process.env.MOCK_MERGE_EXIT);
} else exit = 2;
fs.writeFileSync(p, JSON.stringify(s));
process.exit(exit);
`, { mode: 0o755 });
  const result = spawnSync("bash", ["-c", `set -euo pipefail
sleep() { SECONDS=$((SECONDS + 1)); }
${block}
echo RELEASE_CONTINUES
`], {
    encoding: "utf8", timeout: 5000,
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`,
      MOCK_STATE: statePath, MOCK_MERGE_EXIT: String(mergeExit),
      PR_NUMBER: "123", MERGE_TIMEOUT_SECONDS: String(timeout),
      BASE_BRANCH: "main", TAG: "v1.2.3" },
  });
  assert.ifError(result.error);
  return { ...result, state: JSON.parse(readFileSync(statePath, "utf8")) };
}

test("immediate merge still requires observed MERGED state", () => {
  const result = runScenario(["MERGED"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.state.reads >= 1);
  assert.match(result.stdout, /RELEASE_CONTINUES/u);
});

test("successful queue acceptance waits through OPEN until MERGED", () => {
  const result = runScenario(["OPEN", "OPEN", "MERGED"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.state.reads >= 3);
  assert.match(result.stdout, /RELEASE_CONTINUES/u);
});

test("initial merge failure continues checking until eventual merge", () => {
  const result = runScenario(["OPEN", "MERGED"], { mergeExit: 1 });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.state.reads >= 2);
});

for (const state of ["CLOSED", "API_ERROR", "UNKNOWN"]) {
  test(`${state} fails closed even when merge command succeeds`, () => {
    const result = runScenario([state]);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /RELEASE_CONTINUES/u);
    assert.match(result.stderr, /closed without merging|Unable to read|Unexpected/u);
  });
}

test("queued merge fails at bounded deadline without releasing", () => {
  const result = runScenario(["OPEN"], { timeout: 2 });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /RELEASE_CONTINUES/u);
  assert.match(result.stderr, /did not merge within/u);
  assert.ok(result.state.reads <= 3);
});
