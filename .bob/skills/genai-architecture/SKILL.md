---
name: genai-architecture
version: 1.0.0
description: >
  Planning-level architecture guidance for generative-AI workloads on AWS, Azure, and GCP:
  pattern selection, model access and hosting, RAG and vector stores, agents and tool use,
  safety and governance, evaluation and LLMOps, cost and capacity, and reliability. Includes
  decision trees, anti-patterns, review checks, and cloud service mappings.
when_to_use: >
  Load when a spec involves an LLM, RAG, embeddings, an AI agent, a copilot or chatbot, or a
  managed model service (Amazon Bedrock, Microsoft Foundry, Gemini Enterprise Agent Platform).
  For batch LLM summarisation of documents, also load document-processing-profile (it owns the
  LLM service integration rules). For vector or analytical stores, also load
  data-architecture-patterns. Finish with well-architected-review.
---

# GenAI Architecture

Design guidance only; no code, prompts, or IaC. Cover only clouds declared in the spec.
Never pin a model ID from memory: record the model class and criteria, or cite the provider
lifecycle page with a retrieval date (see document-processing-profile). Do not assert regulatory
conclusions: compliance mapping (GxP, HIPAA, GDPR, EU AI Act) is an open decision for the named
human owner.

## Skill navigation

| Section | Use when |
|---|---|
| [Pattern selection](#pattern-selection) | Direct call vs RAG vs customisation vs agent vs batch |
| [Model access and hosting](#model-access-and-hosting) | Catalog, throughput, residency, version pinning, gateway |
| [RAG architecture](#rag-architecture) | Chunking, vector store, hybrid search, access-aware retrieval |
| [Agents and tool use](#agents-and-tool-use) | Orchestration, tool permissions, MCP/A2A, limits |
| [Safety and governance](#safety-and-governance) | Guardrails, injection threats, PII, logging, oversight |
| [Evaluation and LLMOps](#evaluation-and-llmops) | Eval sets, gates, monitoring, canary, rollback |
| [Cost and capacity](#cost-and-capacity) | Token economics, caching, batch, quotas |
| [Reliability](#reliability) | Outage fallback, multi-region, degradation |
| [Required design content](#required-design-content) | Deliverable checklist |
| [Review checks](#review-checks) | Pillar questions and GenAI lenses |
| [Anti-patterns](#anti-patterns) | Sanity check |
| [Cloud service reference](#cloud-service-reference) | Component matrix |
| [Grounding sources](#grounding-sources) | Where claims were verified |

---

## Pattern selection

```
What does the task need that the base model lacks?
├── Nothing (transform, classify, draft, general knowledge) → Direct call + structured output + eval set
├── Private/fast-changing facts, or answers must cite sources → RAG
├── Consistent style or narrow accuracy that prompt + RAG cannot reach
│     → Customisation, only AFTER a measured prompt + RAG baseline (a tuned model is tied to
│       its base version and that version's deprecation)
├── Multi-step work that must pick tools or loop → Agent; prefer a fixed workflow (LLM at some
│     nodes) unless the path cannot be enumerated
└── Large volume, nobody waiting → Batch inference (an axis combinable with any of the above)
```

| Heuristic | Direct | RAG | Customised | Agent |
|---|---|---|---|---|
| Freshness | Training cut-off | Re-index cadence | Stale until retrained | Live via tools |
| Citations | None | Native | None | If tools return sources |
| Cost | Lowest | + embeddings, store | + training, hosting | Highest, unpredictable |
| Determinism | Moderate | Moderate | Higher (narrow task) | Lowest; bound it |

Climb one rung at a time, with eval evidence.

## Model access and hosting

| Cloud | Managed access (names verified 2026-10-26) |
|---|---|
| AWS | Amazon Bedrock. Bedrock Agents is now "Agents Classic", closed to new customers; AgentCore is the successor. |
| Azure | **Microsoft Foundry** (formerly Azure AI Foundry): Foundry Models (Azure OpenAI plus partners) and Foundry Agent Service. |
| GCP | **Gemini Enterprise Agent Platform** (Vertex AI is now part of it; docs say "Agent Platform"). APIs/SDKs still show `aiplatform`/`vertexai`. |

```
Steady, high volume, or latency guarantees needed?
├── No  → Pay-per-token (Standard / Priority / Flex per cloud)
├── Yes → Reserved / Provisioned Throughput per cloud
└── Not time-sensitive → Batch (~50% off, 24 h class)
```

Record per model: mode, tokens/minute, quota, overflow behaviour. Reserved capacity is per model
and Region, so a swap or failover can strand it.

**Residency.** State storage and inference-processing axes separately. AWS: geographic cross-Region
inference stays within a geography; global may process anywhere; inference profiles do not support
Provisioned Throughput. Azure: Global types may process anywhere; Data Zone stays in US/EU/APAC;
provisioned stays in geography. GCP: Global gives no residency guarantee; Regional and `us`/`eu`
multi-region constrain processing (EU excludes UK/Switzerland). Logs, caches, and indexes are
separate residency surfaces.

**Version pinning.** AWS: Active → Legacy → EOL; Legacy blocks new Provisioned Throughput. Azure:
Standard types auto-upgrade at retirement, **provisioned deployments do not**; previews have no
standard lifecycle. GCP: ≥12 months notice for long-lived models, ≥45 days for short-term. Pin
versions; gate migrations on evals.

**Gateway.** For several models, tenants, or clouds, add a routing layer (auth, token quotas,
fallback, safety hooks): Azure API Management AI gateway, cloud-neutral proxy, or Bedrock Converse.
Skip for one model/team.

**Private connectivity.** PrivateLink; Azure private endpoints/managed VNet; GCP VPC Service
Controls. Plan egress.

## RAG architecture

Pipeline: sources/permissions → parse → chunk → embed (one model per index) → index with
ACL/tenant/date metadata and source URI → hybrid retrieve → rerank → generate with citations and
"no context" refusal. Changing the embedding model requires a full re-index.

```
Existing DB, moderate scale? → Aurora pgvector | Cosmos DB (DiskANN) | AlloyDB AI
Managed RAG? → Bedrock Knowledge Bases | Azure AI Search / Foundry IQ | RAG Engine
Rich hybrid search? → OpenSearch | Azure AI Search
Warehouse-resident? → BigQuery VECTOR_SEARCH
```

| Cloud | Options and notes |
|---|---|
| AWS | Knowledge Bases: OpenSearch, Aurora pgvector, Neptune, S3 Vectors, MongoDB Atlas. Only OpenSearch supports binary vectors; reranker available. |
| Azure | AI Search: hybrid, semantic ranker (top 50; keep k=50), security filters, document-level ACLs (preview modes). Cosmos DB: DiskANN. |
| GCP | RAG Engine: Vector Search 2.0 (preview), Vector Search 1.0, Spanner-based (CMEK); no sparse, no hybrid. AlloyDB: pgvector/ScaNN. BigQuery: IVF/TreeAH. |

Tenancy: one index per tenant, or a server-enforced mandatory tenant filter; never an advisory
filter on a shared index. Measure retrieval (recall@k, MRR) separately.

**Access-aware retrieval.** Enforce with the end user's verified identity at retrieval, never by
the prompt. Azure AI Search `search.in` filters (applied by trusted code on every query) with
ACL/RBAC/Purview-label ingestion; Bedrock `userContext` (filtering, not authentication; missing
ACL → denied; eventually consistent; IdP credentials cached ≤1 h); Foundry Agent Service passes
the caller's token to the knowledge base. Record permission source of truth, revoke window, and
no-ACL behaviour (deny).

**Freshness and citation.** Per source: incremental, scheduled, or full rebuild. Deletions and
permission changes must propagate. Return source references.

## Agents and tool use

```
Steps listable? Yes → workflow. No → bounded agent loop (max steps, token budget, timeout,
tool allow-list, approval on state change).
Managed runtime (AgentCore Runtime | Foundry Agent Service | Agent Runtime) for isolation and
observability; containers + framework for portability.
```

| Element | Rule |
|---|---|
| Identity | One identity per agent; least privilege per tool; narrow tools (no "run any query"); enable only needed MCP tools |
| State changes | Human approval for irreversible or external actions; show exact arguments |
| Idempotency | Idempotency key on every write tool |
| Limits | Max iterations, tokens, tool calls; stop on repeated identical calls |
| Memory | Separate session from long-term memory; manage as data (classify/retain/delete); scope per user |
| Protocols | MCP (tools) and A2A (agents): each connected server or agent is an external trust boundary |

Protocol support: AgentCore Runtime (MCP, A2A); Foundry Agent Service (A2A v1.0 GA, MCP via
toolboxes); Agent Platform (MCP, A2A on Agent Runtime, Preview). Registries and gateways vary in
maturity (Agent Gateway was Private Preview): re-verify before relying on them.

## Safety and governance

| Threat | Design response |
|---|---|
| Direct injection/jailbreak | Input guardrail; separate user text from instructions; no secrets in prompts |
| **Indirect injection** (hidden in retrieved docs, email, tool output) | Treat retrieved and tool content as untrusted; scan; limit follow-on tools |
| Exfiltration (URLs, markdown images, tool calls, memory) | Egress allow-list; strip active content; output guardrail |
| Excessive agency | Least privilege, per-user delegation, approval gates, audit |
| Poisoned sources or tuning data | Ingestion allow-list, provenance, review before indexing |

| Cloud | Guardrail service and caveats |
|---|---|
| AWS | Bedrock Guardrails (content, denied topics, PII, prompt attack). Prompt-attack detection requires input tagging on InvokeModel; untagged input is not filtered. |
| Azure | Foundry guardrails (Prompt Shields, content harms). User-prompt attack on by default; **document attack off by default**, needs delimited documents; tool-call/response points preview; mainly English. |
| GCP | Model Armor (injection/jailbreak, RAI filters, PII, malicious URLs; model-agnostic). De-identified output not returned (block only); files not screened inline; screening **skipped if Model Armor is unreachable or absent in the Region**. |

Guardrails are probabilistic; they do not replace authorisation, least privilege, or egress control.
Tune in log-only mode, then enforce. Decide fail-open vs fail-closed per guardrail.

**PII and logging.** Decide where PII is removed; record the trade-off. Bedrock invocation logging
is off by default and can store full content; Foundry tracing can capture inputs, outputs, and tool
arguments. Default to metadata-only logs plus sampled, short-retention content logs.
**Provenance:** per answer record model, prompt, and index versions, source IDs.
**Oversight:** name reviewers, decisions covered, override path. **Responsible-AI documentation:**
intended use, limitations, eval results, sources, owner.

## Evaluation and LLMOps

| Practice | Design content |
|---|---|
| Offline eval set | Versioned; adversarial, refusal, per-tenant slices; owner, cadence; retrieval metrics separate from generation; calibrate LLM judges to human labels |
| Regression gate | Every prompt, model, retrieval, or guardrail change runs the suite in CI; pin datasets and evaluators |
| Release | Canary or A/B; shadow traffic for model swaps; rollback |
| Online monitoring | Groundedness, refusal/block rates, TTFT, cost per request, throttles, query-mix drift |
| Tracing | Every model, retrieval, tool call; kill switch per feature, tool, tenant |

Native tooling: AgentCore Evaluations/Observability; Foundry evaluations and agent monitoring;
Agent Platform Gen AI evaluation service (Agent Observability is Preview).

## Cost and capacity

Cost = (input + output tokens) × unit price × volume; RAG context and agent loops multiply input
tokens. Give a range with assumptions; firm figures need FinOps review.

| Lever | AWS | Azure | GCP |
|---|---|---|---|
| Prompt/context cache | Bedrock prompt caching (model dependent) | Re-verify | Implicit (90% off hits, 24 h) and explicit |
| Semantic cache | Build | APIM (needs Azure Managed Redis) | Build |
| Batch | ~50% | 50% (Global/Data Zone) | 50%; stacks with cache on Gemini 3+ |
| Latency-tolerant tier | Flex | Not verified | Flex PayGo (Preview, global only) |

Semantic caches key on tenant and permission scope (TTL; exclude personalised prompts). For
429/503: capped backoff + jitter (transient only, never content-policy errors), queues for
non-interactive work, per-consumer budgets. Azure backends can return very large `Retry-After`:
cap waits and fail over. Route simple steps to smaller models.

## Reliability

```
Transient (timeout, 5xx, short 429) → bounded retry with backoff + jitter
Sustained 429 / capacity → second Region or profile → pre-evaluated second model → degraded mode
Provider-wide outage → alternate provider only if prepared (eval'd, contracted, residency-
                       compatible); else degraded mode
Degraded mode = cached/FAQ answer, retrieval-only results with citations, queue and notify, or
"unavailable". Never silently switch to an un-evaluated model.
```

Per-hop timeouts (retrieval, model, tool). Residency decides routing: in-geography profiles, Data
Zone or multi-region endpoints when residency binds; Global gives more quota but **no residency
guarantee**. Reserved capacity is regional: failover needs its own reservation or on-demand path.
Circuit-break and bulkhead the model dependency; isolate batch from interactive quota. Checkpoint
agent state. State RPO/RTO for index rebuild.

## Required design content

1. Pattern chosen, rejected alternatives, eval evidence.
2. Model access: catalog, model class, throughput mode, quotas, storage and inference residency, lifecycle/migration, gateway, private connectivity.
3. RAG: sources, owners, permission model, chunking, embedding, store and tenancy boundary, hybrid/rerank, freshness, citation and no-context behaviour.
4. Agents: tool inventory with permissions, approval gates, idempotency, limits, memory, protocols.
5. Safety: threat model, guardrail placement and fail mode, PII, logging/retention, provenance, oversight, responsible-AI owner.
6. Evaluation: eval set owner, metrics, gates, monitoring, canary, rollback.
7. Cost range with assumptions; caching, batch, quota plan; fallback chain, degraded mode, timeouts, RPO/RTO.
8. Open decisions: compliance mapping (human owner), model selection (ML platform owner), every "re-verify" item.

## Review checks

Use with well-architected-review. Optional lenses: AWS GenAI/Agentic/Responsible AI; Azure Well-Architected AI workloads; Google Cloud AI and ML perspective (URLs in Grounding sources).

| Pillar | Questions |
|---|---|
| Operational excellence | Eval set and regression gate for prompt, model, retrieval changes? Answers traceable to model, prompt, index versions? Rollback, kill switch? Who owns deprecation notices? |
| Security | Document-level authorisation at retrieval with end-user identity? Indirect injection handled? Agent tools least-privilege with approval? Egress restricted? Logs PII-minimised? |
| Reliability | Behaviour on 429s, regional loss, provider outage? Fallback model pre-evaluated, residency-compliant? Index rebuild within RTO? |
| Performance efficiency | Retrieval measured separately? Model sized per step? Latency budgets met under load? |
| Cost optimization | Token cost range with assumptions? Caching, batch, routing used? Per-consumer budgets, agent cost caps? |
| Sustainability (optional) | Smallest adequate model? Batch and off-peak for non-urgent work? |

## Anti-patterns

| Anti-pattern | Why it fails | Instead |
|---|---|---|
| No authorisation at retrieval (prompt says "only answer for allowed docs") | Model can be coaxed to reveal retrieved text | User-scoped filters or ACLs in retrieval |
| One giant index for all tenants | One filter bug leaks across tenants | Index or hard partition per tenant |
| Unpinned versions, previews in production, reliance on auto-upgrade | Silent model change; forced retirement | Pin, track lifecycle, migrate via eval gate |
| No eval set or regression gate | Silent quality decay | Versioned eval set gating every change |
| Agents with broad write tools, no approval | Injection becomes real-world action | Narrow tools, approval, idempotency |
| Trusting retrieved or tool content as instructions | Indirect injection | Treat as data; scan; limit tools |
| Logging raw PII prompts by default | Privacy liability | Metadata-first logs, redaction, short retention |
| Guardrails as the only control | Probabilistic; may fail open | Defence in depth; explicit fail mode |
| Unbounded agent loops or retries | Runaway cost, latency | Step, token, time limits; budget alarms |
| Global endpoint where residency applies | Processing leaves the geography | Geographic, data-zone, or multi-region endpoint |
| Fine-tuning before a prompt + RAG baseline | Cost, version lock, no evidence | Climb the ladder |
| Semantic cache without identity in key | Cross-user answer leakage | Key on tenant and permission scope |
| Silent fallback to an un-evaluated model | Quality/compliance regression | Pre-evaluate fallbacks; degrade visibly |
| Swapping the embedding model in place | Mixed vector spaces | New index, cut-over |

## Cloud service reference

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Managed RAG | Knowledge Bases | AI Search, Foundry IQ | RAG Engine |
| Guardrails | Bedrock Guardrails | Foundry guardrails | Model Armor |
| Agent runtime | AgentCore | Foundry Agent Service | Agent Runtime |

Names change quarterly: verify via Grounding sources.

## Grounding sources

Verified 2026-10-26 via AWS, Microsoft Learn, and Google developer knowledge MCP servers.
Re-verify after three months; Preview and "re-verify" items need a fresh check.

| Claim area | Source |
|---|---|
| AWS GenAI/Agentic/Responsible AI Lenses | docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/generative-ai-lens.html |
| Bedrock residency, tiers, lifecycle, Knowledge Bases, Guardrails | docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html |
| AgentCore MCP/A2A; batch savings (re-verify) | docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-how-it-works.html |
| Foundry naming, deployments, lifecycle, guardrails, agents | learn.microsoft.com/azure/foundry/what-is-foundry |
| AI Search ACLs, filters, ranker | learn.microsoft.com/azure/search/search-document-level-access-overview |
| Azure Well-Architected AI workloads | learn.microsoft.com/azure/well-architected/ai/design-principles |
| GCP renames, lifecycle, residency, batch, Flex, caching | docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes |
| AlloyDB, BigQuery vectors, Model Armor, RAG Engine | docs.cloud.google.com/alloydb/docs/ai/choose-index-strategy |
| Google Cloud Well-Architected AI/ML | docs.cloud.google.com/architecture/framework/perspectives/ai-ml |
