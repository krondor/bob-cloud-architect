#!/usr/bin/env node
// install.mjs — installs the cloud-architect Bob mode and its assets into a target
// workspace's .bob/ folder, without cloning this repo into that workspace.
//
// Usage (from the target workspace):
//   npx github:krondor/bob-cloud-architect [target-dir] [options]
//   node /path/to/bob-cloud-architect/scripts/install.mjs [target-dir] [options]
//
// By default, installs:
//   - Custom mode definition (.bob/custom_modes.yaml)
//   - Mode rules (.bob/rules-cloud-architect/)
//   - Skills (.bob/skills/)
//   - MCP server config (.bob/mcp.json.example)
//   - AGENTS.md operating contract
//   - Starter spec templates (specs/)
//   - Mode guide and customization docs (README-cloud-architect.md)
//
// Options:
//   --dry-run             Print what would change; write nothing.
//   --force               Replace an existing cloud-architect block and overwrite template files.
//   --git-exclude         Add installed paths to .git/info/exclude (local-only ignore).
//   --no-agents           Skip copying AGENTS.md.
//   --no-mcp              Skip copying .bob/mcp.json.example.
//   --no-templates        Skip copying starter specs (specs/).
//   --no-skills           Skip copying .bob/skills/.
//   --no-rules            Skip copying .bob/rules-cloud-architect/.
//   --no-mode             Skip updating .bob/custom_modes.yaml.
//   --no-readme           Skip copying mode documentation (README-cloud-architect.md).
//   -h, --help            Show help message.
//
// Merge rules: custom_modes.yaml is merged (never overwritten unless --force).
// Existing files (AGENTS.md, mcp.json.example, specs) are preserved unless --force is specified.

import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync, statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SLUG = "cloud-architect";
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("-")));
const positional = args.filter((a) => !a.startsWith("-"));

if (flags.has("-h") || flags.has("--help")) {
  console.log(`
Usage:
  npx github:krondor/bob-cloud-architect [target-dir] [options]
  node scripts/install.mjs [target-dir] [options]

By default, installs:
  - Custom mode definition (.bob/custom_modes.yaml)
  - Mode rules (.bob/rules-cloud-architect/)
  - Skills (.bob/skills/)
  - MCP server config (.bob/mcp.json.example)
  - AGENTS.md operating contract
  - Starter spec templates (specs/)
  - Mode guide and customization docs (README-cloud-architect.md)

Options:
  --dry-run             Print what would change; write nothing.
  --force               Replace existing mode block and overwrite existing files.
  --git-exclude         Add installed paths to .git/info/exclude (local-only ignore).
  --no-agents           Skip installing AGENTS.md.
  --no-mcp              Skip installing .bob/mcp.json.example.
  --no-templates        Skip installing starter specs (specs/).
  --no-skills           Skip installing skills in .bob/skills/.
  --no-rules            Skip installing mode rules in .bob/rules-cloud-architect/.
  --no-mode             Skip updating .bob/custom_modes.yaml.
  --no-readme           Skip copying mode documentation (README-cloud-architect.md).
  -h, --help            Show this help message.
`);
  process.exit(0);
}

const DRY = flags.has("--dry-run");
const FORCE = flags.has("--force");
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

function ensureDir(p) {
  if (!DRY) mkdirSync(p, { recursive: true });
}

function copy(srcRel, destRel, { overwrite = true } = {}) {
  const src = join(SRC, srcRel);
  const dest = join(TARGET, destRel);
  if (!existsSync(src)) {
    console.error(`Missing source asset: ${srcRel}`);
    process.exit(1);
  }
  if (!overwrite && existsSync(dest)) {
    return log(`skip   ${destRel} (already exists; use --force to overwrite)`);
  }
  ensureDir(dirname(dest));
  if (!DRY) cpSync(src, dest, { recursive: true, dereference: true, force: true });
  installed.push(destRel);
  log(`copy   ${destRel}`);
}

function installModes() {
  const rel = ".bob/custom_modes.yaml";
  const dest = join(TARGET, rel);
  const srcText = readFileSync(join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
  const srcBlock = srcText.split("\n").slice(1).join("\n").trimEnd();
  installed.push(rel);

  if (!existsSync(dest)) {
    ensureDir(dirname(dest));
    if (!DRY) writeFileSync(dest, srcText);
    return log(`create ${rel}`);
  }

  const destText = readFileSync(dest, "utf8").replace(/\r\n/g, "\n");
  if (/^customModes:\s*(\[\s*\])?\s*$/m.test(destText) && !/^\s+- slug:/m.test(destText)) {
    if (!DRY) writeFileSync(dest, srcText);
    return log(`fill   ${rel} (was empty)`);
  }
  if (!/^customModes:\s*$/m.test(destText) || !/^ {2}- /m.test(destText) || /^(?!customModes:)\S/m.test(destText)) {
    console.error(`${rel} has an unexpected layout. Add the mode manually from ${join(SRC, rel)}.`);
    process.exit(1);
  }

  const start = destText.search(new RegExp(`^ {2}- slug: ${SLUG}\\s*$`, "m"));
  if (start === -1) {
    if (!DRY) writeFileSync(dest, `${destText.trimEnd()}\n${srcBlock}\n`);
    return log(`append ${rel} (added ${SLUG})`);
  }
  if (!FORCE) return log(`skip   ${rel} (${SLUG} already present; use --force to replace it)`);
  const rest = destText.slice(start + 1);
  const next = rest.search(/^ {2}- /m);
  const end = next === -1 ? destText.length : start + 1 + next;
  if (!DRY) writeFileSync(dest, `${destText.slice(0, start)}${srcBlock}\n${destText.slice(end)}`);
  log(`replace ${rel} (${SLUG} block)`);
}

// ── run ────────────────────────────────────────────────────────────────────────
console.log(`Source: ${SRC}\nTarget: ${TARGET}\n`);

// 1. Custom mode definition
if (!NO_MODE) {
  installModes();
} else {
  log("skip   .bob/custom_modes.yaml (--no-mode)");
}

// 2. Mode rules
if (!NO_RULES) {
  copy(`.bob/rules-${SLUG}`, `.bob/rules-${SLUG}`);
} else {
  log(`skip   .bob/rules-${SLUG}/ (--no-rules)`);
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
  copy(".bob/mcp.json.example", ".bob/mcp.json.example", { overwrite: FORCE });
} else {
  log("skip   .bob/mcp.json.example (--no-mcp)");
}

// 5. AGENTS.md
if (!NO_AGENTS) {
  copy("AGENTS.md", "AGENTS.md", { overwrite: FORCE });
} else {
  log("skip   AGENTS.md (--no-agents)");
}

// 6. Starter spec templates
if (!NO_TEMPLATES) {
  for (const [from, to] of [["specs/001-example", "specs/001-example"], ["specs/TEMPLATE", "specs/TEMPLATE"]]) {
    copy(from, to, { overwrite: FORCE });
  }
} else {
  log("skip   specs/ (--no-templates)");
}

// 7. Mode documentation & customization guide
if (!NO_README) {
  copy("README.md", `README-${SLUG}.md`, { overwrite: FORCE });
} else {
  log(`skip   README-${SLUG}.md (--no-readme)`);
}

// 8. Local-only Git ignore
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
console.log("  2. Pick the 'Cloud Architect' mode.");
console.log(`  3. Review README-${SLUG}.md for mode documentation, usage, and customization.`);
console.log("  4. Fill in AGENTS.md and specs/ with your architecture requirements.");
console.log("  5. Optional: configure cloud doc MCP servers in .bob/mcp.json (from .bob/mcp.json.example).");
if (nodeMajor < 18) console.log("  Warning: Node >= 18 is required to run this installer.");
