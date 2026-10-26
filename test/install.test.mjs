// Regression tests for scripts/install.mjs. Repo-only: not shipped to clients
// (excluded by the `files` allowlist in package.json; the installer never copies test/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INSTALLER = join(ROOT, "scripts", "install.mjs");
const SLUG = "cloud-architect";
const REVIEWER_SLUG = "architecture-reviewer";
const ALL_SLUGS = [SLUG, REVIEWER_SLUG];

function workspace() {
  return mkdtempSync(join(tmpdir(), "bob-install-"));
}

function install(target, ...flags) {
  const res = spawnSync("node", [INSTALLER, target, ...flags], { encoding: "utf8" });
  assert.equal(res.status, 0, `installer failed:\n${res.stdout}\n${res.stderr}`);
  return res.stdout;
}

const modes = (target) => parse(readFileSync(join(target, ".bob", "custom_modes.yaml"), "utf8")).customModes;
const countSlug = (target) => modes(target).filter((m) => m.slug === SLUG).length;

test("fresh install creates mode, rules, skills and lock file", () => {
  const t = workspace();
  try {
    install(t);
    assert.equal(countSlug(t), 1);
    assert.ok(existsSync(join(t, ".bob", `rules-${SLUG}`, "01-role.md")));
    assert.ok(existsSync(join(t, ".bob", "skills", "cloud-architecture-patterns", "SKILL.md")));
    const lock = JSON.parse(readFileSync(join(t, ".bob", `${SLUG}.lock.json`), "utf8"));
    assert.ok(lock.version);
    assert.match(lock.files[`.bob/rules-${SLUG}/01-role.md`], /^[0-9a-f]{64}$/);
    // Legacy `mode` field and new `modes` map both present
    assert.match(lock.mode, /^[0-9a-f]{64}$/);
    assert.match(lock.modes[SLUG], /^[0-9a-f]{64}$/);
    assert.match(lock.modes[REVIEWER_SLUG], /^[0-9a-f]{64}$/);
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("reinstall preserves locally customized rules without --force", () => {
  const t = workspace();
  try {
    install(t);
    const rule = join(t, ".bob", `rules-${SLUG}`, "01-role.md");
    writeFileSync(rule, "# my local customization\n");
    const out = install(t);
    assert.equal(readFileSync(rule, "utf8"), "# my local customization\n");
    assert.match(out, /skip\s+\.bob\/rules-cloud-architect\/01-role\.md/);
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("--force overwrites a locally customized rule", () => {
  const t = workspace();
  try {
    install(t);
    const rule = join(t, ".bob", `rules-${SLUG}`, "01-role.md");
    writeFileSync(rule, "# my local customization\n");
    install(t, "--force");
    assert.equal(readFileSync(rule, "utf8"), readFileSync(join(ROOT, ".bob", `rules-${SLUG}`, "01-role.md"), "utf8"));
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("upgrade replaces an untouched installed file", () => {
  const t = workspace();
  try {
    install(t);
    const lockPath = join(t, ".bob", `${SLUG}.lock.json`);
    const rule = join(t, ".bob", `rules-${SLUG}`, "01-role.md");
    // Simulate an older release: installed content differs from source but matches the lock.
    writeFileSync(rule, "# older release\n");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.files[`.bob/rules-${SLUG}/01-role.md`] = createHash("sha256").update(readFileSync(rule)).digest("hex");
    writeFileSync(lockPath, JSON.stringify(lock));
    install(t);
    assert.equal(readFileSync(rule, "utf8"), readFileSync(join(ROOT, ".bob", `rules-${SLUG}`, "01-role.md"), "utf8"));
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("quoted existing slug is recognised; no duplicate mode is appended", () => {
  const t = workspace();
  try {
    mkdirSync(join(t, ".bob"));
    writeFileSync(
      join(t, ".bob", "custom_modes.yaml"),
      'customModes:\n  - slug: "cloud-architect"\n    name: My Custom Architect\n    roleDefinition: mine\n    groups: [read]\n',
    );
    install(t);
    assert.equal(countSlug(t), 1);
    assert.equal(modes(t).find((m) => m.slug === SLUG).name, "My Custom Architect");
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("existing unrelated modes are preserved and the mode is appended", () => {
  const t = workspace();
  try {
    mkdirSync(join(t, ".bob"));
    writeFileSync(
      join(t, ".bob", "custom_modes.yaml"),
      "customModes:\n  - slug: other\n    name: Other\n    roleDefinition: x\n    groups: [read]\n",
    );
    install(t);
    assert.deepEqual(modes(t).map((m) => m.slug).sort(), ["architecture-reviewer", "cloud-architect", "other"]);
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("empty customModes list is filled", () => {
  const t = workspace();
  try {
    mkdirSync(join(t, ".bob"));
    writeFileSync(join(t, ".bob", "custom_modes.yaml"), "customModes: []\n");
    install(t);
    assert.equal(countSlug(t), 1);
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("default install ships templates only: no active example spec", () => {
  const t = workspace();
  try {
    install(t);
    assert.deepEqual(readdirSync(join(t, "specs")), ["TEMPLATE"]);
    const all = readdirSync(join(t, "specs", "TEMPLATE")).map((f) => readFileSync(join(t, "specs", "TEMPLATE", f), "utf8"));
    for (const text of all) assert.doesNotMatch(text, /\*\*Status:\*\*\s*active/i);
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("--with-examples installs the example specs", () => {
  const t = workspace();
  try {
    install(t, "--with-examples");
    assert.ok(readdirSync(join(t, "specs")).includes("001-doc-processing-platform"));
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("--dry-run writes nothing", () => {
  const t = workspace();
  try {
    install(t, "--dry-run");
    assert.deepEqual(readdirSync(t), []);
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("repo-only assets never reach the client workspace", () => {
  const t = workspace();
  try {
    install(t, "--with-examples");
    for (const p of ["test", "node_modules", "package.json", "scripts", "PLAN.md", "CONTRIBUTING.md"]) {
      assert.equal(existsSync(join(t, p)), false, `${p} must not be installed`);
    }
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("published package excludes tests", () => {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8" });
  const paths = JSON.parse(out)[0].files.map((f) => f.path);
  assert.ok(paths.includes("scripts/install.mjs"));
  assert.equal(paths.filter((p) => p.startsWith("test/")).length, 0);
});

test("skill versions in SKILL.md match skills-lock.json", () => {
  const lock = JSON.parse(readFileSync(join(ROOT, "skills-lock.json"), "utf8"));
  for (const [name, entry] of Object.entries(lock.skills)) {
    const text = readFileSync(join(ROOT, entry.path), "utf8");
    const fm = parse(text.split(/^---\s*$/m)[1]);
    assert.equal(fm.name, name);
    assert.equal(String(fm.version), entry.version, `${name} version drift`);
  }
});

test("spec template starts as draft with approval pending", () => {
  const text = readFileSync(join(ROOT, "specs", "TEMPLATE", "spec.md"), "utf8");
  assert.match(text, /^\*\*Status:\*\* draft/m);
  assert.match(text, /^\*\*Requirements approval:\*\* pending/m);
});

test("mode instructions define the spec lifecycle and no longer require one-pass delivery", () => {
  const mode = modesFromSource().find((m) => m.slug === SLUG);
  assert.match(mode.customInstructions, /Spec lifecycle/);
  assert.doesNotMatch(mode.customInstructions, /one pass/i);
  assert.doesNotMatch(mode.customInstructions, /status "active"/i);
});

function modesFromSource() {
  return parse(readFileSync(join(ROOT, ".bob", "custom_modes.yaml"), "utf8")).customModes;
}

test("base mode constraints are cloud-agnostic: no unconditional three-cloud parity or PII-before-LLM", () => {
  const mode = modesFromSource().find((m) => m.slug === SLUG);
  // Three-cloud parity must be conditional on spec, not an unconditional hard constraint
  assert.doesNotMatch(mode.customInstructions, /AWS, Azure, and GCP are always equal targets/);
  assert.doesNotMatch(mode.customInstructions, /always equal targets/i);
  // PII-before-LLM is a doc-processing profile constraint, not a base mode constraint
  assert.doesNotMatch(mode.customInstructions, /PII must be sanitized before/i);
  // Base rules must not mention three-cloud as unconditional
  const rules = [
    readFileSync(join(ROOT, ".bob", "rules-cloud-architect", "06-deliverable-format.md"), "utf8"),
    readFileSync(join(ROOT, ".bob", "rules-cloud-architect", "07-cost-optimization.md"), "utf8"),
  ];
  for (const text of rules) {
    assert.doesNotMatch(text, /Iceberg Parquet.*reconciliation/i, "base rule must not reference doc-processing schemas");
    assert.doesNotMatch(text, /LLM token cost/i, "LLM token cost rule belongs in doc-processing profile skill");
  }
});

test("document-processing-profile skill exists and declares profile constraints", () => {
  const skillPath = join(ROOT, ".bob", "skills", "document-processing-profile", "SKILL.md");
  assert.ok(existsSync(skillPath), "document-processing-profile skill must exist");
  const text = readFileSync(skillPath, "utf8");
  assert.match(text, /PII must be sanitized before any document content reaches an LLM API/);
  assert.match(text, /reconciliation_ledger/);
  assert.match(text, /processed_summaries/);
  assert.match(text, /Snowflake/);
});

test("well-architected-review skill has no unconditional [POC] checks", () => {
  const text = readFileSync(join(ROOT, ".bob", "skills", "well-architected-review", "SKILL.md"), "utf8");
  assert.doesNotMatch(text, /\[POC\]/);
  assert.match(text, /document-processing-profile/, "WAR skill must reference the profile skill for additional checks");
});

test("spec template includes profile field", () => {
  const text = readFileSync(join(ROOT, "specs", "TEMPLATE", "spec.md"), "utf8");
  assert.match(text, /\*\*Profile:\*\*/);
});

test("example spec declares document-processing profile", () => {
  const text = readFileSync(join(ROOT, "specs", "001-doc-processing-platform", "spec.md"), "utf8");
  assert.match(text, /\*\*Profile:\*\* document-processing/);
});

test("default install installs all modes: cloud-architect and architecture-reviewer", () => {
  const t = workspace();
  try {
    install(t);
    const slugs = modes(t).map((m) => m.slug).sort();
    assert.ok(slugs.includes(SLUG), "cloud-architect must be installed");
    assert.ok(slugs.includes(REVIEWER_SLUG), "architecture-reviewer must be installed");
    assert.ok(existsSync(join(t, ".bob", `rules-${REVIEWER_SLUG}`, "01-role.md")));
    const lock = JSON.parse(readFileSync(join(t, ".bob", `${SLUG}.lock.json`), "utf8"));
    assert.match(lock.modes[REVIEWER_SLUG], /^[0-9a-f]{64}$/, "lock must record architecture-reviewer hash");
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("--modes cloud-architect installs only cloud-architect, not architecture-reviewer", () => {
  const t = workspace();
  try {
    install(t, "--modes", "cloud-architect");
    const slugs = modes(t).map((m) => m.slug);
    assert.ok(slugs.includes(SLUG), "cloud-architect must be installed");
    assert.equal(slugs.includes(REVIEWER_SLUG), false, "architecture-reviewer must NOT be installed");
    assert.equal(existsSync(join(t, ".bob", `rules-${REVIEWER_SLUG}`)), false,
      "rules-architecture-reviewer must not be created");
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("--modes architecture-reviewer installs only architecture-reviewer", () => {
  const t = workspace();
  try {
    install(t, "--modes", "architecture-reviewer");
    const slugs = modes(t).map((m) => m.slug);
    assert.ok(slugs.includes(REVIEWER_SLUG), "architecture-reviewer must be installed");
    assert.equal(slugs.includes(SLUG), false, "cloud-architect must NOT be installed");
    assert.ok(existsSync(join(t, ".bob", `rules-${REVIEWER_SLUG}`, "01-role.md")));
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("architecture-reviewer mode has no edit, mcp, or mode groups", () => {
  const reviewer = modesFromSource().find((m) => m.slug === REVIEWER_SLUG);
  assert.ok(reviewer, "architecture-reviewer must exist in source YAML");
  const groups = reviewer.groups ?? [];
  for (const forbidden of ["edit", "mcp", "mode"]) {
    assert.equal(groups.includes(forbidden), false, `architecture-reviewer must not have "${forbidden}" group`);
  }
  assert.ok(groups.includes("read"), "architecture-reviewer must have read group");
  assert.ok(groups.includes("skill"), "architecture-reviewer must have skill group");
});

test("architecture-reviewer allowedSubagents is effective: subagent group present, restricted to explore", () => {
  const reviewer = modesFromSource().find((m) => m.slug === REVIEWER_SLUG);
  assert.deepEqual(reviewer.allowedSubagents, ["explore"],
    "architecture-reviewer must restrict subagents to explore only");
  // Bob's allowedSubagents only restricts presets of the `subagent` group; without the group it is inert.
  assert.ok(reviewer.groups.includes("subagent"), "allowedSubagents has no effect without the subagent group");
});

test("--modes with a space-separated value works without an explicit target directory", () => {
  const t = workspace();
  try {
    const res = spawnSync("node", [INSTALLER, "--modes", REVIEWER_SLUG, "--dry-run"], { cwd: t, encoding: "utf8" });
    assert.equal(res.status, 0, `installer failed:\n${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, new RegExp(`Modes:\\s+${REVIEWER_SLUG}`));
    assert.doesNotMatch(res.stdout + res.stderr, /Target is not a directory/);
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("package version is at least 0.2.0 (v0.2.0 shipped modes and per-mode lock entries)", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const [maj, min] = pkg.version.split(".").map(Number);
  assert.ok(maj > 0 || min >= 2, `package.json version ${pkg.version} is behind the v0.2.0 release`);
});

test("spec template includes checkpoint.md", () => {
  const checkpointPath = join(ROOT, "specs", "TEMPLATE", "checkpoint.md");
  assert.ok(existsSync(checkpointPath), "specs/TEMPLATE/checkpoint.md must exist");
  const text = readFileSync(checkpointPath, "utf8");
  assert.match(text, /Spec revision/);
  assert.match(text, /Next action/);
});

test("mode workflow references checkpoint.md for session resumption", () => {
  const mode = modesFromSource().find((m) => m.slug === SLUG);
  assert.match(mode.customInstructions, /checkpoint\.md/,
    "cloud-architect customInstructions must reference checkpoint.md");
});

// ---- Phase 5: reduced mandatory context ----

const rulesDir = join(ROOT, ".bob", "rules-cloud-architect");
const readRule = (f) => readFileSync(join(rulesDir, f), "utf8");

test("always-loaded rules carry no provider service tables (moved to the patterns skill)", () => {
  for (const f of readdirSync(rulesDir)) {
    const text = readRule(f);
    assert.doesNotMatch(text, /\|\s*Capability\s*\|\s*AWS\s*\|/, `${f} has a provider service table`);
    assert.doesNotMatch(text, /\|\s*Cloud\s*\|\s*Upload/, `${f} has an integration mapping table`);
  }
});

test("always-loaded rules stay within the size ceiling", () => {
  const rules = readdirSync(rulesDir).reduce((n, f) => n + readRule(f).length, 0);
  const ceiling = 22500; // chars across .bob/rules-cloud-architect; ratchet down in later phases
  assert.ok(rules <= ceiling, `rules are ${rules} chars, ceiling ${ceiling}`);
});

test("patterns skill holds the moved reference sections and a navigation entry point", () => {
  const text = readFileSync(join(ROOT, ".bob", "skills", "cloud-architecture-patterns", "SKILL.md"), "utf8");
  for (const h of ["## Skill navigation", "## Cloud service reference", "## Integration pattern mappings", "## HA/DR reference", "## Cost reference"]) {
    assert.ok(text.includes(h), `missing ${h}`);
  }
});

test("pattern catalog no longer contradicts itself on choreography and sagas (F14)", () => {
  const std = readRule("04-architecture-standards.md");
  assert.doesNotMatch(std, /Compensating transactions required; flow > 4–5 steps/);
  const skill = readFileSync(join(ROOT, ".bob", "skills", "cloud-architecture-patterns", "SKILL.md"), "utf8");
  assert.match(skill, /simple application/i, "decision tree needs a simple-application branch");
  assert.doesNotMatch(skill, /Is strict ordering required across all events\?/);
});

test("significant recommendations require the four justification questions", () => {
  const std = readRule("04-architecture-standards.md");
  for (const k of ["Forcing requirement", "Simpler alternative", "Operational burden", "Evidence that would change"]) {
    assert.ok(std.includes(k), `missing "${k}"`);
  }
});

test("artifacts live under docs/<spec-id>/ with an evidence register (F15)", () => {
  const fmt = readRule("06-deliverable-format.md");
  assert.match(fmt, /docs\/<spec-id>\//);
  assert.match(fmt, /evidence-register\.md/);
  assert.doesNotMatch(fmt, /prefixed with the spec number/);
  const mode = modesFromSource().find((m) => m.slug === SLUG);
  assert.match(mode.customInstructions, /docs\/<spec-id>\//);
  assert.match(mode.customInstructions, /evidence-register\.md/);
});

// ---- Review-findings fixes (plan 006) ----

const patternsSkill = () => readFileSync(join(ROOT, ".bob", "skills", "cloud-architecture-patterns", "SKILL.md"), "utf8");

test("patterns skill holds no document-processing sections (owned by the profile skill)", () => {
  const text = patternsSkill();
  for (const h of ["## Serverless Batch Aggregator pattern", "## Apache Iceberg", "## Snowflake Cortex", "## End-to-end reconciliation"]) {
    assert.equal(text.includes(h), false, `duplicated section "${h}" must live only in the profile skill`);
  }
  assert.doesNotMatch(text, /LLM per document|Shared Iceberg credentials|Reconciliation as afterthought/);
  const profile = readFileSync(join(ROOT, ".bob", "skills", "document-processing-profile", "SKILL.md"), "utf8");
  for (const h of ["## Serverless Batch Aggregator pattern", "## Apache Iceberg", "## Snowflake and Snowflake Cortex", "## End-to-end reconciliation", "## Anti-patterns for this profile"]) {
    assert.ok(profile.includes(h), `profile skill missing "${h}"`);
  }
});

test("decision tree has no dead-end branch pointing at patterns the catalog does not define", () => {
  const text = patternsSkill();
  assert.doesNotMatch(text, /Data Mesh|Lambda\/Kappa/);
  // Every navigation anchor must resolve to a heading in the skill.
  const slug = (h) => h.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  const anchors = new Set([...text.matchAll(/^#{2,3} (.+)$/gm)].map((m) => slug(m[1])));
  for (const m of text.matchAll(/\]\(#([^)]+)\)/g)) {
    assert.ok(anchors.has(m[1]), `navigation anchor #${m[1]} has no matching heading`);
  }
});

test("universal rules carry no document-processing residue and no placeholder headers", () => {
  for (const f of readdirSync(rulesDir)) {
    const text = readRule(f);
    assert.doesNotMatch(text, /doc-validator|batch-aggregator|Batch aggregator|Processed documents/, `${f} has doc-processing residue`);
    assert.doesNotMatch(text, /<!-- always active -->/, `${f} has a redundant header`);
  }
});

test("review skill marks P0 questions and defines a read-only findings handoff", () => {
  const text = readFileSync(join(ROOT, ".bob", "skills", "well-architected-review", "SKILL.md"), "utf8");
  assert.ok((text.match(/\*\*\[P0\]\*\*/g) ?? []).length >= 4, "P0 questions must be marked");
  assert.match(text, /review-findings/);
  const reviewerRule = readFileSync(join(ROOT, ".bob", "rules-architecture-reviewer", "01-role.md"), "utf8");
  assert.match(reviewerRule, /review-findings/);
  const architect = modesFromSource().find((m) => m.slug === SLUG);
  assert.match(architect.customInstructions, /review-findings/);
});

// ---- Skill grounding and data-architecture skill (plan 006) ----

test("well-architected-review uses current Google framework URLs and lists optional Sustainability", () => {
  const text = readFileSync(join(ROOT, ".bob", "skills", "well-architected-review", "SKILL.md"), "utf8");
  assert.doesNotMatch(text, /https:\/\/cloud\.google\.com\/architecture\/framework/, "legacy Google framework URL");
  assert.match(text, /docs\.cloud\.google\.com\/architecture\/framework\/performance-optimization/);
  assert.match(text, /## Pillar 6 — Sustainability \(optional\)/);
});

test("patterns skill uses current service names", () => {
  const text = patternsSkill();
  assert.doesNotMatch(text, /Cognitive Search|Cloud Functions/);
});

test("data-architecture-patterns skill exists, anchors resolve, and it is wired into the mode and decision tree", () => {
  const p = join(ROOT, ".bob", "skills", "data-architecture-patterns", "SKILL.md");
  assert.ok(existsSync(p), "data-architecture-patterns skill must exist");
  const text = readFileSync(p, "utf8");
  assert.match(text, /^name: data-architecture-patterns$/m);
  assert.match(text, /^## Anti-patterns$/m);
  assert.match(text, /^## Grounding sources$/m);
  const slug = (h) => h.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  const anchors = new Set([...text.matchAll(/^#{2,3} (.+)$/gm)].map((m) => slug(m[1])));
  for (const m of text.matchAll(/\]\(#([^)]+)\)/g)) {
    assert.ok(anchors.has(m[1]), `navigation anchor #${m[1]} has no matching heading`);
  }
  assert.match(patternsSkill(), /load data-architecture-patterns/);
  const modes = readFileSync(join(ROOT, ".bob", "custom_modes.yaml"), "utf8");
  assert.match(modes, /data-architecture-patterns/);
  assert.match(readFileSync(join(ROOT, "AGENTS.md"), "utf8"), /data-architecture-patterns/);
});
