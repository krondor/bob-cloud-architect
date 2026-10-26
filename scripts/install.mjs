#!/usr/bin/env node
// install.mjs — installs cloud architect Bob modes and their assets into a target
// workspace's .bob/ folder, without cloning this repo into that workspace.
//
// Usage (from the target workspace):
//   npx github:krondor/bob-cloud-architect [target-dir] [options]
//   node /path/to/bob-cloud-architect/scripts/install.mjs [target-dir] [options]
//
// By default, installs all modes:
//   - Custom mode definitions (.bob/custom_modes.yaml) — cloud-architect + architecture-reviewer
//   - Mode rules (.bob/rules-cloud-architect/, .bob/rules-architecture-reviewer/)
//   - Skills (.bob/skills/)
//   - MCP server config (.bob/mcp.json.example)
//   - AGENTS.md operating contract
//   - Blank spec template (specs/TEMPLATE)
//   - Mode guide and customization docs (README-cloud-architect.md)
//   - Install record (.bob/cloud-architect.lock.json)
//
// Options:
//   --modes a,b           Install only the named mode slugs (comma-separated).
//                         Default: cloud-architect,architecture-reviewer
//   --dry-run             Print what would change; write nothing.
//   --force               Overwrite locally modified files and replace existing mode entries.
//   --with-examples       Also install example specs (specs/NNN-*). Off by default.
//   --git-exclude         Add installed paths to .git/info/exclude (local-only ignore).
//   --no-agents           Skip copying AGENTS.md.
//   --no-mcp              Skip copying .bob/mcp.json.example.
//   --no-templates        Skip copying spec templates (specs/).
//   --no-skills           Skip copying .bob/skills/.
//   --no-rules            Skip copying .bob/rules-*/ directories.
//   --no-mode             Skip updating .bob/custom_modes.yaml.
//   --no-readme           Skip copying mode documentation (README-cloud-architect.md).
//   -h, --help            Show help message.
//
// Upgrade rules: every installed file is recorded with a SHA-256 in
// .bob/cloud-architect.lock.json. On reinstall a file is replaced only if it is missing,
// identical to the new version, or still matches the recorded hash (never edited locally).
// Locally modified files are kept unless --force is given. Mode entries in
// custom_modes.yaml are matched by slug through a YAML parser and follow the same rule.

import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync, statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// All mode slugs shipped by this package (in installation order)
const ALL_SLUGS = ["cloud-architect", "architecture-reviewer"];
const PRIMARY_SLUG = "cloud-architect";
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("-") && !a.startsWith("--modes=")));
const positional = args.filter((a) => !a.startsWith("-"));

// Parse --modes flag (accepts --modes=a,b or --modes a,b)
let slugsArg = args.find((a) => a.startsWith("--modes="));
if (!slugsArg) {
  const modesIdx = args.indexOf("--modes");
  if (modesIdx !== -1 && args[modesIdx + 1] && !args[modesIdx + 1].startsWith("-")) {
    slugsArg = `--modes=${args[modesIdx + 1]}`;
  }
}
const SLUGS = slugsArg
  ? slugsArg.replace("--modes=", "").split(",").map((s) => s.trim()).filter(Boolean)
  : ALL_SLUGS;

// Validate requested slugs
for (const s of SLUGS) {
  if (!ALL_SLUGS.includes(s)) {
    console.error(`Unknown mode slug: "${s}". Available: ${ALL_SLUGS.join(", ")}`);
    process.exit(1);
  }
}

if (flags.has("-h") || flags.has("--help")) {
  console.log(`
Usage:
  npx github:krondor/bob-cloud-architect [target-dir] [options]
  node scripts/install.mjs [target-dir] [options]   (run \`npm install\` in the checkout first)

By default, installs all modes: ${ALL_SLUGS.join(", ")}

Options:
  --modes a,b           Install only the named mode slugs (comma-separated).
  --dry-run             Print what would change; write nothing.
  --force               Overwrite locally modified files and replace existing mode entries.
  --with-examples       Also install example specs (specs/NNN-*). Off by default.
  --git-exclude         Add installed paths to .git/info/exclude (local-only ignore).
  --no-agents           Skip installing AGENTS.md.
  --no-mcp              Skip installing .bob/mcp.json.example.
  --no-templates        Skip installing spec templates (specs/).
  --no-skills           Skip installing skills in .bob/skills/.
  --no-rules            Skip installing mode rules in .bob/rules-*/.
  --no-mode             Skip updating .bob/custom_modes.yaml.
  --no-readme           Skip copying mode documentation (README-cloud-architect.md).
  -h, --help            Show this help message.
`);
  process.exit(0);
}

let YAML;
try {
  YAML = await import("yaml");
} catch {
  console.error(`Missing dependency "yaml". Run \`npm install\` in ${SRC} first (not needed with npx).`);
  process.exit(1);
}
const { parseDocument, isMap, isSeq } = YAML;

const DRY = flags.has("--dry-run");
const FORCE = flags.has("--force");
const WITH_EXAMPLES = flags.has("--with-examples");
const NO_AGENTS = flags.has("--no-agents") || flags.has("--without-agents");
const NO_MCP = flags.has("--no-mcp") || flags.has("--without-mcp");
const NO_TEMPLATES = flags.has("--no-templates") || flags.has("--without-templates");
const NO_SKILLS = flags.has("--no-skills") || flags.has("--without-skills");
const NO_RULES = flags.has("--no-rules") || flags.has("--without-rules");
const NO_MODE = flags.has("--no-mode") || flags.has("--without-mode");
const NO_README = flags.has("--no-readme") || flags.has("--without-readme");

const TARGET = resolve(positional[0] ?? process.cwd());

if (resolve(TARGET) === SRC) {
  console.error("Refusing to install into the source repo itself. Pass a target workspace directory.");
  process.exit(1);
}
if (!existsSync(TARGET) || !statSync(TARGET).isDirectory()) {
  console.error(`Target is not a directory: ${TARGET}`);
  process.exit(1);
}

const installed = [];
const log = (msg) => console.log(`${DRY ? "[dry-run] " : ""}${msg}`);

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const posix = (p) => p.split(sep).join("/");
const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
const modeHash = (item) => sha256(JSON.stringify(canon(item.toJSON())));

// ── install record ─────────────────────────────────────────────────────────────
const LOCK_REL = `.bob/${PRIMARY_SLUG}.lock.json`;
const lockPath = join(TARGET, LOCK_REL);
let prior = { files: {}, modes: {} };
if (existsSync(lockPath)) {
  try {
    const raw = JSON.parse(readFileSync(lockPath, "utf8"));
    prior.files = raw.files ?? {};
    // Migrate legacy single `mode` field to `modes` map
    prior.modes = raw.modes ?? {};
    if (raw.mode && !prior.modes[PRIMARY_SLUG]) prior.modes[PRIMARY_SLUG] = raw.mode;
  } catch {
    prior = { files: {}, modes: {} };
  }
}
const pkg = JSON.parse(readFileSync(join(SRC, "package.json"), "utf8"));
const lock = { version: pkg.version, modes: { ...prior.modes }, files: { ...prior.files } };
// Keep legacy `mode` field for backward compat with older lock files
Object.defineProperty(lock, "_legacyMode", { get() { return this.modes[PRIMARY_SLUG]; }, enumerable: false });

function ensureDir(p) {
  if (!DRY) mkdirSync(p, { recursive: true });
}

function copy(srcRel, destRel) {
  const src = join(SRC, srcRel);
  const dest = join(TARGET, destRel);
  if (!existsSync(src)) {
    console.error(`Missing source asset: ${srcRel}`);
    process.exit(1);
  }
  if (statSync(src).isDirectory()) {
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      copy(join(srcRel, entry.name), join(destRel, entry.name));
    }
    return;
  }

  const key = posix(destRel);
  const srcHash = sha256(readFileSync(src));
  const existed = existsSync(dest);
  if (existed) {
    const destHash = sha256(readFileSync(dest));
    if (destHash === srcHash) {
      lock.files[key] = srcHash;
      installed.push(destRel);
      return log(`ok     ${destRel} (up to date)`);
    }
    const untouched = prior.files[key] === destHash;
    if (!FORCE && !untouched) {
      return log(`skip   ${destRel} (locally modified or not installed by this tool; use --force to overwrite)`);
    }
  }
  ensureDir(dirname(dest));
  if (!DRY) cpSync(src, dest, { dereference: true, force: true });
  lock.files[key] = srcHash;
  installed.push(destRel);
  log(`${existed ? "update" : "copy  "} ${destRel}`);
}

function installMode(slug) {
  const rel = ".bob/custom_modes.yaml";
  const dest = join(TARGET, rel);
  const srcText = readFileSync(join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
  const srcDoc = parseDocument(srcText);
  const srcModes = srcDoc.get("customModes");
  if (!isSeq(srcModes)) {
    console.error(`Source ${rel} has no customModes sequence.`);
    process.exit(1);
  }
  const srcItem = srcModes.items.find((n) => isMap(n) && n.get("slug") === slug);
  if (!srcItem) {
    console.error(`Mode slug "${slug}" not found in source ${rel}.`);
    process.exit(1);
  }
  const srcHash = modeHash(srcItem);
  installed.push(rel);

  const isNewFile = !existsSync(dest) || readFileSync(dest, "utf8").trim() === "";
  if (isNewFile) {
    // Fresh install: create a file with only the requested slugs
    ensureDir(dirname(dest));
    if (DRY) {
      lock.modes[slug] = srcHash;
      return log(`append ${rel} (added ${slug})`);
    }
    writeFileSync(dest, "customModes: []\n");
    // Fall through to the append path below to add only the requested slug
  }

  const destDoc = parseDocument(readFileSync(dest, "utf8"));
  if (destDoc.errors.length > 0 || !isMap(destDoc.contents)) {
    console.error(`${rel} is not valid YAML with a top-level mapping. Add the mode manually from ${join(SRC, rel)}.`);
    process.exit(1);
  }

  const seq = destDoc.get("customModes");
  if (!isSeq(seq)) {
    destDoc.set("customModes", srcDoc.get("customModes"));
    if (!DRY) writeFileSync(dest, destDoc.toString());
    lock.modes[slug] = srcHash;
    return log(`fill   ${rel} (customModes was missing)`);
  }

  const idx = seq.items.findIndex((n) => isMap(n) && n.get("slug") === slug);
  if (idx === -1) {
    if (seq.items.length === 0) seq.flow = false;
    seq.items.push(srcItem);
    if (!DRY) writeFileSync(dest, destDoc.toString());
    lock.modes[slug] = srcHash;
    return log(`append ${rel} (added ${slug})`);
  }

  const destHash = modeHash(seq.items[idx]);
  if (destHash === srcHash) {
    lock.modes[slug] = srcHash;
    return log(`ok     ${rel} (${slug} up to date)`);
  }
  const untouched = prior.modes[slug] === destHash;
  if (!FORCE && !untouched) {
    return log(`skip   ${rel} (${slug} locally modified or not installed by this tool; use --force to replace it)`);
  }
  seq.items[idx] = srcItem;
  if (!DRY) writeFileSync(dest, destDoc.toString());
  lock.modes[slug] = srcHash;
  log(`replace ${rel} (${slug} entry)`);
}

// ── run ────────────────────────────────────────────────────────────────────────
console.log(`Source: ${SRC}\nTarget: ${TARGET}\nModes:  ${SLUGS.join(", ")}\n`);

// 1. Custom mode definitions (one pass per requested slug)
if (!NO_MODE) {
  for (const slug of SLUGS) {
    installMode(slug);
  }
} else {
  log("skip   .bob/custom_modes.yaml (--no-mode)");
}

// 2. Mode rules (one rules-{slug}/ directory per requested slug)
if (!NO_RULES) {
  for (const slug of SLUGS) {
    const rulesDir = `.bob/rules-${slug}`;
    if (existsSync(join(SRC, rulesDir))) {
      copy(rulesDir, rulesDir);
    } else {
      log(`skip   ${rulesDir}/ (no rules directory in source for ${slug})`);
    }
  }
} else {
  log("skip   .bob/rules-*/ (--no-rules)");
}

// 3. Skills
if (!NO_SKILLS) {
  const skillsSrc = join(SRC, ".bob/skills");
  if (existsSync(skillsSrc) && statSync(skillsSrc).isDirectory()) {
    const skillDirs = readdirSync(skillsSrc, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    if (skillDirs.length > 0) {
      for (const skill of skillDirs) {
        copy(`.bob/skills/${skill}`, `.bob/skills/${skill}`);
      }
    } else {
      log("skip   .bob/skills/ (no skills found in source)");
    }
  } else {
    log("skip   .bob/skills/ (directory absent in source)");
  }
} else {
  log("skip   .bob/skills/ (--no-skills)");
}

// 4. MCP example config
if (!NO_MCP) {
  copy(".bob/mcp.json.example", ".bob/mcp.json.example");
} else {
  log("skip   .bob/mcp.json.example (--no-mcp)");
}

// 5. AGENTS.md
if (!NO_AGENTS) {
  copy("AGENTS.md", "AGENTS.md");
} else {
  log("skip   AGENTS.md (--no-agents)");
}

// 6. Spec templates (examples only with --with-examples)
if (!NO_TEMPLATES) {
  const specsSrc = join(SRC, "specs");
  if (existsSync(specsSrc) && statSync(specsSrc).isDirectory()) {
    const specDirs = readdirSync(specsSrc, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
    for (const specDir of specDirs) {
      if (specDir === "TEMPLATE" || WITH_EXAMPLES) {
        copy(`specs/${specDir}`, `specs/${specDir}`);
      } else {
        log(`skip   specs/${specDir} (example; use --with-examples to install)`);
      }
    }
  } else {
    log("skip   specs/ (no specs directory found in source)");
  }
} else {
  log("skip   specs/ (--no-templates)");
}

// 7. Mode documentation & customization guide
if (!NO_README) {
  copy("README.md", `README-${PRIMARY_SLUG}.md`);
} else {
  log(`skip   README-${PRIMARY_SLUG}.md (--no-readme)`);
}

// 8. Install record
const lockToWrite = {
  version: lock.version,
  modes: lock.modes,
  // Legacy compatibility: keep `mode` field pointing at the primary slug's hash
  mode: lock.modes[PRIMARY_SLUG],
  files: lock.files,
};
if (!DRY && (Object.keys(lock.modes).length > 0 || Object.keys(lock.files).length > 0)) {
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, `${JSON.stringify(lockToWrite, null, 2)}\n`);
}
installed.push(LOCK_REL);

// 9. Local-only Git ignore
if (flags.has("--git-exclude")) {
  const gitDir = join(TARGET, ".git");
  if (!existsSync(gitDir) || !statSync(gitDir).isDirectory()) {
    log("skip   --git-exclude (target has no .git directory)");
  } else {
    const file = join(gitDir, "info", "exclude");
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    const wanted = [...new Set([...installed, ".bob/mcp.json"])].map((p) =>
      existsSync(join(TARGET, p)) && statSync(join(TARGET, p)).isDirectory() ? `${p}/` : p,
    );
    const missing = wanted.filter((p) => !current.split("\n").includes(p));
    if (missing.length === 0) {
      log("ok     .git/info/exclude (already up to date)");
    } else {
      if (!DRY) {
        mkdirSync(dirname(file), { recursive: true });
        appendFileSync(file, `${current && !current.endsWith("\n") ? "\n" : ""}# cloud-architect Bob assets (local only)\n${missing.join("\n")}\n`);
      }
      log(`exclude .git/info/exclude (+${missing.length} entries)`);
    }
  }
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
console.log(`\nDone. Next steps in ${TARGET}:`);
console.log("  1. Reopen the folder in Bob and trust the workspace.");
console.log("  2. Pick the 'Cloud Architect' mode for design work.");
console.log("     Pick the 'Architecture Reviewer' mode for reviewing completed deliverables.");
console.log(`  3. Review README-${PRIMARY_SLUG}.md for mode documentation, usage, and customization.`);
console.log("  4. Fill in AGENTS.md and copy specs/TEMPLATE to specs/NNN-name/ for your architecture requirements.");
console.log("  5. Optional: configure cloud doc MCP servers in .bob/mcp.json (from .bob/mcp.json.example).");
if (nodeMajor < 18) console.log("  Warning: Node >= 18 is required to run this installer.");
