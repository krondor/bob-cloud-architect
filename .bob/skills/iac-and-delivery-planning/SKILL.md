---
name: iac-and-delivery-planning
version: 1.0.0
description: >
  Planning-level guidance for infrastructure-as-code and CI/CD on AWS, Azure, and GCP: IaC tool
  selection and licensing status, state and environment design, policy-as-code, landing-zone
  structure, pipeline stages, keyless CI authentication (OIDC), supply-chain controls, GitOps,
  progressive delivery, and rollback. Decisions, checklists, and anti-patterns only.
when_to_use: >
  Load when a design provisions cloud infrastructure, selects an IaC tool, defines environments or
  accounts/subscriptions/projects, designs a deployment pipeline, or when a review must assess
  Operational Excellence or Security for delivery and change management.
---

# IaC and Delivery Planning

Design guidance only. No Terraform/HCL, pipeline YAML, Bicep, or other implementation code. Include only clouds declared in the spec. **re-verify** marks facts not confirmed against vendor documentation on 2026-10-26.

## Skill navigation

| Section | Use when |
|---|---|
| [Tool selection](#tool-selection) | Choosing Terraform, OpenTofu, Pulumi, CDK, CloudFormation, Bicep, or a GCP tool |
| [Design decisions to record](#design-decisions-to-record) | Repo, state, layering, promotion, drift, secrets, policy, tagging |
| [Landing-zone structure](#landing-zone-structure) | Multi-account / subscription / project foundation |
| [CI/CD planning](#cicd-planning) | Stages, platform, OIDC auth, supply chain, GitOps, rollout, rollback |
| [Required design content](#required-design-content) | Paste-ready checklist |
| [Review checks](#review-checks) | Reviewer questions (Operational Excellence, Security) |
| [Anti-patterns](#anti-patterns) | Review checks |
| [Cloud service reference](#cloud-service-reference) | Component selection matrix |
| [Grounding sources](#grounding-sources) | Where each claim was verified |

---

## Tool selection

```
Single cloud, and the team is fluent in that cloud's native tool?
├── AWS   → CloudFormation, or AWS CDK (code that synthesises to CloudFormation)
├── Azure → Bicep (compiles to ARM)
├── GCP   → Terraform via Infrastructure Manager (managed). Never start on Deployment Manager.
└── No (multi-cloud, or SaaS/platform providers in scope)
      ├── Prefers general-purpose languages and unit-test tooling → Pulumi
      │     (CDK for Terraform is deprecated: do not select)
      └── Prefers declarative HCL and the largest provider/module ecosystem
            ├── BSL licence and HashiCorp-vendor products acceptable → Terraform
            └── Open governance or native state encryption needed, or BSL blocks
                procurement → OpenTofu
```

Record tool with rationale, pinned version, and exit cost. Mixed estates require an owner and reason per boundary (e.g. native landing zone with Terraform workloads).

| Tool | State | Licence / status (verified 2026-10-26 unless noted) |
|---|---|---|
| Terraform | Remote backend (S3, Azure Blob, GCS, HCP Terraform) | MPL 2.0 → BSL 1.1 on 2023-08-10; APIs/SDKs stay MPL 2.0; competitive-offering restriction. Later ownership: **re-verify** |
| OpenTofu | Same backends; native state/plan encryption | Linux Foundation fork post-BSL; v1.13.x; registry for TF providers. State compatibility to TF 1.5.x; later: **re-verify** |
| Pulumi | Pulumi Cloud, or DIY object store / PostgreSQL | Commercial; drift detection requires paid Pulumi Cloud |
| AWS CDK / CloudFormation | CloudFormation (service-managed) | AWS-supported (AWS only); includes drift detection and Guard Hooks |
| CDK for Terraform | Terraform backends | **Deprecated 2025-12-10; no longer supported/maintained** |
| Bicep / ARM | None (ARM is source of truth); optional deployment stacks | Microsoft-supported (Azure only); tolerates out-of-band changes well; optional deployment stacks |
| GCP Infrastructure Manager | Cloud Storage, service-managed | Runs Terraform; preview shows drift; rollback is roll-forward |
| GCP Config Connector | Kubernetes API | Open-source Kubernetes CRDs |
| GCP Deployment Manager | Service-managed | **Discontinued 2026-04-01; new users blocked 2026-06-30; turn-down post 2027-06-30**; migrate via DM Convert |

Native tools win for single-cloud or vendor landing zones. Pin Terraform or OpenTofu. AFT documents HCP/Enterprise/Community; OpenTofu in AFT: **re-verify**.

---

## Design decisions to record

| Decision | Guidance |
|---|---|
| Repo strategy | Monorepo (atomic change, one policy, broad blast radius) vs Polyrepo (narrow access, module drift). Standard: foundation repo, versioned module repo, workload repos. Enforce CODEOWNERS & branch protection. |
| Module registry | Private registry or tagged Git; semver; consumers pin. Prefer vendor-verified (e.g. Azure Verified Modules). |
| State isolation | One state per env × component × blast-radius boundary. Dedicated admin account for state storage. |
| Locking | Required. S3 backend supports native lockfiles; DynamoDB locking is deprecated. Azure Blob & GCS locking: **re-verify**. |
| State encryption and access | CMK/KMS per policy, versioning, restricted read access. OpenTofu adds native state/plan encryption (one KMS key per state). |
| Layering | Foundation (org, network) → shared platform (DNS, logging, clusters) → workload. Share data via output contracts. |
| Promotion | Same code, different parameters; promote immutable versioned artifacts dev → test → prod; no per-env forks; gate prod. |
| Drift detection | Scheduled plan/refresh, alerts, owner. Native: CFN drift, Azure what-if/deny stacks, GCP Infra Manager preview. Remediate or adopt; define break-glass window. |
| Secrets | Never in code, tfvars, or CI. Reference cloud secret managers by ID; workloads fetch at runtime. Encrypt and restrict state. |
| Policy-as-code | Preventive: AWS SCPs (not on management account), Azure Policy, GCP Org Policy. Pre-deploy: OPA/Conftest, Sentinel, CFN Guard. Define blocking vs advisory & exceptions. |
| Tagging / naming | Mandatory keys (owner, cost centre, env, data class, app, IaC source); enforce via policy (GCP: labels vs tags). Deterministic naming & length limits. |
| Version pinning | Pin CLI and provider versions, commit lockfiles, schedule pipeline upgrades. |

---

## Landing-zone structure

| Concern | AWS | Azure | GCP |
|---|---|---|---|
| Hierarchy | Organizations (management account, OUs, accounts) | Management groups, subscriptions | Organization, folders, projects |
| Guardrails | SCPs, Control Tower controls | Azure Policy at management groups | Organization Policy (inherited) |
| Accelerator | Control Tower, AFT | ALZ accelerator (AVM Bicep/TF; GitHub/ADO); subscription vending | Foundations blueprint, `terraform-example-foundation`, factory modules. CFT naming: **re-verify** |
| Pipeline home | Tooling/AFT account | Platform subscriptions | Bootstrap folder: seed/CI projects for state & SAs |

Record: isolation unit, vending rules, prod/non-prod hierarchy separation, shared accounts (security/audit, log archive, network, identity, tooling), pipeline-only foundation changes (alert on break-glass), residency policy, sovereign cloud rules. Treat as a versioned product.

---

## CI/CD planning

```
Infrastructure pipeline
PR:    1 Validate (format, static analysis, secret scan, dependency review)
       2 Plan (speculative, READ-ONLY identity, output on PR)
       3 Policy check (OPA/Conftest, Sentinel, Guard; blocking vs advisory)
Merge: 4 Approve (protected environment; non-author reviewer; stricter for prod)
       5 Apply (WRITE identity scoped to one environment; reviewed version)
       6 Verify (smoke checks, drift baseline, audit record)
Application pipeline
build once → test → scan (SAST, deps, image) → SBOM → sign/attest → publish immutable
artifact by digest → promote (never rebuild) → progressive rollout with health gates → auto-rollback
```

| Platform | Choose when | Watch-outs |
|---|---|---|
| GitHub Actions | Source on GitHub; broad ecosystem; OIDC to AWS/Azure/GCP | Marketplace action risk; runners non-ephemeral by default |
| GitLab CI | GitLab source/registry/CI; ID-token OIDC (GCP docs confirm) | Runner & variable scoping |
| Azure DevOps | Microsoft estate; work-item traceability | ADO-issuer federation retires 2027-07-01: migrate to Entra issuer |
| CodePipeline / Cloud Build + Deploy | Single cloud, native IAM, minimal external trust | AWS CodeCommit availability/gaps: **re-verify** |

Decide based on source location, approval audit needs, private runners, and skills. Do not run two platforms for the same layer.

### Keyless authentication (OIDC / workload identity federation)

| Cloud | Mechanism | Constraints to specify |
|---|---|---|
| AWS | IAM OIDC provider + role per env | Constrain audience/subject. GitHub custom claims unavailable in AWS. Post-2026-07-15 repos use immutable subject claims with IDs. |
| Azure | Federated credentials on app reg / managed identity; ADO connections | One identity per env; least-privilege RBAC; authorize pipelines individually (not "all pipelines"). |
| GCP | Workload Identity Federation pool/provider; SA impersonation | Restrict repo attributes; dedicated pool project; no SA keys; HCP Terraform requires impersonation. |

Rules: separate plan (read-only) and apply (write) identities; bind apply to protected env/branch; least-privilege roles with guardrail backstops (boundaries, SCPs, deny assignments, Org Policy); no laptop applies; human prod access read-only with audited break-glass.

### Supply-chain controls

| Control | Requirement |
|---|---|
| Third-party actions | Pin to full commit SHA or use lockfiles. Verify SHA is from origin repo. Dependabot skips pinned actions: schedule alternate updates. Org allowlist. |
| Permissions and runners | Default token read-only; avoid `pull_request_target` on untrusted code; CODEOWNERS on workflows; ephemeral runners; no public repo self-hosted runners. |
| Provenance | Signed provenance (Sigstore). GitHub attestations give SLSA v1.0 Level 2 (reusable workflows reach Level 3). Enforce via deploy-time verifier. |
| SBOM and registry | SBOM per release artifact; private registry, image digests, approved base images, scheduled/push scans. |

### GitOps (Kubernetes in scope)

Pull-based reconciliation (Argo CD, Flux): build agents need no cluster credentials; Git is the sole change path. Managed: EKS Capabilities (Argo CD, ACK, kro), AKS Flux extension, GKE Config Sync. Define repo split and promotion. IaC bootstraps cluster/agent; GitOps manages in-cluster state.

### Progressive delivery and rollback

| Strategy | AWS | Azure | GCP |
|---|---|---|---|
| Blue/green | CodeDeploy (ECS, Lambda, EC2); LB target shift: **re-verify** | App Service slots; AKS ingress/mesh: **re-verify** | Cloud Run revisions & traffic management |
| Canary | CodeDeploy canary/linear; weighted routing: **re-verify** | Front Door / App Gateway weights: **re-verify** | Cloud Deploy canary; Cloud Run traffic split |
| Rollback | Redeploy prior version or shift traffic | Swap slot back; redeploy prior artifact | Cloud Deploy rollback; route to prior revision |

Record: app rollback via traffic shift or prior immutable artifact with automated abort thresholds; infra rollback is roll-forward (backups, deletion protection, versioned state); data uses expand-and-contract; test rollback RTO on schedule.

---

## Required design content

```
[ ] Tool of record, pinned version, rationale, exit cost, licence/governance position
[ ] Repo strategy, module registry, CODEOWNERS, branch protection
[ ] State: isolation unit, backend, locking, KMS encryption, versioning, access control
[ ] Layering model and cross-layer output contracts
[ ] Promotion model and environment approval gates
[ ] Drift detection method, schedule, owner, remediate-vs-adopt rule
[ ] Secrets: cloud secret manager, none in code/CI, state security
[ ] Policy-as-code: preventive and pre-deploy rules, blocking vs advisory, exceptions
[ ] Tagging/labelling standard, enforcement, naming convention
[ ] Landing zone: hierarchy, isolation unit, shared accounts, vending, foundation owner
[ ] Pipeline platform and stages (validate, plan, policy, approve, apply, verify)
[ ] CI-to-cloud auth: OIDC with trust conditions; zero long-lived keys
[ ] Separate plan (read) and apply (write) identities per environment; least privilege
[ ] Supply chain: pinned/locked actions, runner model, SBOM, signing, verifier
[ ] Application delivery: artifact promotion, progressive strategy, health gates
[ ] GitOps scope (if Kubernetes): tool, repo layout, promotion, cluster access
[ ] Rollback for application, infra, data; rollback RTO and test cadence
[ ] Break-glass access and reconciliation of emergency console changes
[ ] Open "re-verify" items with owner and date
```

---

## Review checks

**Operational Excellence**
1. Is all production change pipeline-only, and how is that enforced?
2. Is state split so one failed apply cannot impact every environment?
3. How is drift detected, who is alerted, and what is the reconciliation window?
4. Is one versioned artifact promoted across environments without per-env forks?
5. What is the tested rollback path for app, infra, and data, and its objective?
6. Does the landing zone have a defined owner and versioning?
7. Are tool versions pinned, and is any selected tool deprecated (CDK for Terraform, Deployment Manager)? Is the licence approved?

**Security**
8. Does CI use OIDC federation with constrained trust conditions and zero long-lived keys?
9. Are plan and apply identities separate; can PR code ever assume apply?
10. Are deployment roles least-privilege per environment with escalation backstops?
11. Are secrets absent from code, variables, logs; is state encrypted with restricted access?
12. Are third-party actions pinned by SHA or locked, and are runners isolated?
13. Which policies block non-compliant resources pre-deploy vs in the cloud?
14. Are attestations verified before deployment; is an SBOM produced?
15. Is human production access read-only with audited break-glass?
16. Do guardrails address the SCP gap on the AWS management account?

---

## Anti-patterns

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Single shared state across environments | Blast radius across all envs | State per env and layer |
| Apply from laptops | No audit, version skew, endpoint credentials | Pipeline-only apply; humans read-only |
| Long-lived CI cloud keys | Persistent credential leak risk | OIDC federation with subject constraint |
| Shared identity for plan and apply | Untrusted PRs can alter infrastructure | Separate read-only & env-bound identities |
| Unpinned third-party actions | Upstream compromise injects code/secrets | Full SHA or lockfile; allowlist |
| Console fixes without drift detection | Code and reality diverge silently | Scheduled drift detection; reconcile break-glass |
| Warn-only policy checks | Non-compliance deploys unchecked | Block high-risk rules; time-boxed exceptions |
| "All pipelines" access to cloud connection | Any pipeline can deploy anywhere | Per-pipeline authorisation |
| Secrets in tfvars or CI variables | Leaks via logs, plan, and state | Secret-manager references; secure state |
| Per-env code forks or rebuilds | Prod runs untested builds | Build once, promote immutable artifact |
| New work on deprecated tools | Vendor abandonment, forced migration | Select supported tool; plan migration |
| Attestations never verified | Zero security benefit | Enforce verifier at deploy gate |
| Rollback assumed for stateful change | Unproven, data loss risk | Expand/contract, backups, deletion protection |

---

## Cloud service reference

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Native IaC | CloudFormation, CDK | Bicep/ARM, deployment stacks | Infrastructure Manager, Config Connector |
| Policy / drift | Guard, drift detection, AWS Config | Azure Policy, what-if | Org Policy, Infra Manager preview drift |
| Secrets / keys | Secrets Manager / KMS | Key Vault | Secret Manager / Cloud KMS |
| Native CI/CD | CodePipeline, CodeBuild | Azure Pipelines | Cloud Build, Cloud Deploy |
| Managed GitOps | EKS Capabilities (Argo CD) | AKS Flux extension | GKE Config Sync |

---

## Grounding sources

Verified **2026-10-26**. Anything marked "re-verify" was not confirmed; re-check before commitment.

| Claim area | Source |
|---|---|
| Terraform BSL & S3 locking | https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license |
| OpenTofu origin & state encryption | https://opentofu.org/faq/ |
| CDK for Terraform deprecation | https://developer.hashicorp.com/terraform/cdktf |
| Pulumi backends & drift edition | https://www.pulumi.com/docs/iac/concepts/state-and-backends/ |
| AWS Guard, AFT & EKS | https://docs.aws.amazon.com/controltower/latest/userguide/aft-overview.html |
| Azure ALZ & Bicep stacks | https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/implementation-options |
| Azure DevOps federation retirement | https://learn.microsoft.com/azure/devops/pipelines/release/configure-workload-identity |
| GCP Deployment Manager deprecation | https://docs.cloud.google.com/deployment-manager/docs/deprecations |
| GCP Infra Manager & foundations | https://docs.cloud.google.com/infrastructure-manager/docs/release-notes |
| GCP Workload Identity Federation | https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines |
| GitHub hardening, OIDC & SLSA | https://docs.github.com/en/actions/reference/security/secure-use |

**Not verified (re-verify):** Sentinel/OPA specifics; SCP management-account exemption; AWS CodeCommit availability; CodeDeploy, App Service slot, Front Door rollout specifics; Azure Blob/GCS locking; GitLab OIDC beyond GCP docs; OpenTofu in AFT; HashiCorp ownership; CFT naming.
