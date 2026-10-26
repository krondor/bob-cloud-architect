# Phase 7 live evaluation

Run on 2026-10-26 with Bob Shell 2.0.6 (`bob run --mode <slug> --trust --disable-mcp -f stream-json`),
against branch `fix/006-review-findings` at the time of the run. Each scenario ran in a fresh temp
workspace created by `node scripts/install.mjs .` plus the fixture noted below. One run per scenario,
so treat results as indicative, not statistically meaningful.

**Limits of this run**
- MCP was disabled (`--disable-mcp`), so no cloud-documentation grounding was possible. This
  exercised the "documentation unavailable" path, not the grounded path.
- Single samples. Costs are Bob-reported `session_costs`.
- Runs must be serial: parallel `bob run` processes fail with `database is locked`.

## Results

| # | Scenario | Mode | Result | Cost | Tool calls |
|---|---|---|---|---|---|
| S1 | Missing spec, simple AWS-only app | cloud-architect | Pass. Drafted spec/plan/tasks as `draft` / approval `pending`, listed 12 open decisions, produced no architecture. | $0.27 | 7 |
| S2 | Simple single-cloud app, approved spec | cloud-architect | Pass. AWS only, no Azure/GCP content, no queues/saga/CQRS, checkpoint written, task ticked. | $0.37 | 10 |
| S3 | Two qualifying specs | cloud-architect | Pass. Asked which spec; did not guess; no files written. | $0.19 | 3 |
| S4 | "Verify against current docs", docs tooling unavailable | cloud-architect | **Fail, fixed.** Recorded 9 claims as `verified` citing skill text and "standard documentation", and called `search_ibm_docs` for an Azure question. See Fix below. | $1.19 | 18 |
| S5 | Small revision (RPO/RTO set) | cloud-architect | Pass. Edited 5 files minimally, reset approval to pending re-approval, left Task 1 diagrams untouched. | $0.53 | 17 |
| S6 | Interrupted session, "Continue." | cloud-architect | Pass with notes. Resumed from `checkpoint.md`, did Task 2, marked all 24 evidence rows `unverified`. Re-read four files by absolute path after reading them relatively. Marked Task 2 done despite unverified rows. | $0.84 | 16 |
| S7 | "Write the Terraform and commit it" | cloud-architect | Pass. Declined, explained scope, offered the in-scope handoff deliverables. | $0.15 | 3 |
| S8 | Review of S4's deliverable | architecture-reviewer | Pass. No files written, five-pillar table, 20 numbered findings, emitted the `review-findings` handoff block. | $0.32 | 8 |

Total cost for the eight runs: about $3.85.

## Fix applied

S4: the evidence-register rule said only "never record a claim as verified without a source", so the
mode treated its own skill text as a source. `06-deliverable-format.md` now defines `verified` as a
vendor documentation URL opened in this session plus its date, and says skill text and memory are not
sources even when the user asks for verification. `well-architected-review` 1.4.1 adds a review check
that flags `verified` rows with no URL. A test pins both.

## Open observations (not fixed)

- **Over-delivery on S4:** Task 1 ("high-level architecture") produced a 36 KB, 12-section file. The
  task scope in `tasks.md` was one line. Consider a deliverable size or section guidance.
- **S6:** the mode marked a task done while its acceptance criterion ("GA-verified services") was
  only partly met. Consider an "in-review" status in the task template for partially met criteria.
- **S8:** the reviewer's answer was about 25 KB. Its rule asks for minimum tokens; consider capping
  findings detail or putting long remediation text in the handoff block only.
- **Not tested:** grounded runs with MCP enabled, the `well-architected` Sustainability pillar,
  profile loading for `profile: document-processing`, and the data/IaC skills (S4 loaded only
  `genai-architecture` and `cloud-architecture-patterns`).

## Second pass: MCP enabled (same date)

Same harness, with `.bob/mcp.json` copied into each temp workspace (AWS docs, Microsoft Learn, Google
Developer Knowledge servers). Runs were serial.

| # | Scenario | Result | Cost | Tool calls |
|---|---|---|---|---|
| G1 | S4 repeated with MCP: Azure RAG assistant, "verify against current docs" | Pass. 8 Microsoft Learn searches; all 17 evidence rows carry a learn.microsoft.com URL and an access date (S4 had 9 rows "verified" from skill text). Loaded `genai-architecture`. Preview features were labelled (ACL ingestion). | $1.94 | 21 |
| G2 | Multi-cloud (AWS + GCP) data platform, approved spec | **Fail, fixed.** Loaded `data-architecture-patterns` and used both AWS and GCP MCP servers, but made 106 documentation calls in 122 tool calls, hit the $5 cap at $5.50 and wrote no deliverable and no evidence register. | $5.50 | 122 |
| G3 | G2 repeated after the grounding budget was added | Pass. 14 documentation calls in 27 tool calls, deliverable plus evidence register written (14 cited URLs), AWS recommended as primary with GCP at equal depth, `data-architecture-patterns` loaded. | $2.15 | 27 |

### Fix applied

G2: the MCP grounding instruction said "verify before recommending any named cloud service" and
"never recommend a service without confirming GA status". With two clouds, that was unbounded: the
mode kept researching and never wrote. `custom_modes.yaml` now limits verification to
decision-critical services, forbids researching alternatives that will not be recommended, sets a
budget of about 6 lookups per cloud per task, requires writing the evidence register and
deliverable incrementally, and says to mark remaining claims `unverified` when the budget is spent.
A test pins the budget wording.

### Remaining observations

- Grounded deliverables are large (G3: 41 KB, 11 sections) for a one-line task. Same over-delivery
  as S4; consider section guidance in the deliverable-format rule.
- The G3 run took about 8 minutes and $2.15; G1 about 3 minutes and $1.94. Cost per grounded task
  is roughly $2 with this model, which is worth stating in the README.
- Still untested: `iac-and-delivery-planning`, `document-processing-profile` loading, the
  Sustainability pillar, and a reviewer run over a grounded deliverable.
