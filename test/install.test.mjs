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
    assert.match(lock.mode, /^[0-9a-f]{64}$/);
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
    assert.deepEqual(modes(t).map((m) => m.slug).sort(), ["cloud-architect", "other"]);
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
