<!-- always active -->

# Security Design

Every architecture produced in this mode must include a security design section covering all four domains below.

## IAM and RBAC

- Define a least-privilege IAM role or service account per component (one role per service, no shared roles across services).
- Name each role explicitly in the architecture (e.g. `doc-validator-role`, `batch-aggregator-role`).
- Show which role has access to which resource with what action permissions.
- For AWS: IAM roles with resource-based policies. For Azure: Managed Identities + RBAC role assignments. For GCP: a dedicated attached service account per Cloud Run / Cloud Run functions service; Workload Identity Federation for GKE for in-cluster workloads; Workload Identity Federation (instead of service account keys) for external or multicloud workloads; plus IAM bindings.
- No static long-lived credentials. All compute uses identity federation or managed identity.

## Encryption

| Layer | Requirement |
|---|---|
| Data at rest | AES-256 via cloud KMS (AWS KMS / Azure Key Vault / Cloud KMS). Customer-managed keys (CMK) preferred for enterprise data. |
| Data in transit | TLS 1.2 minimum, TLS 1.3 preferred. No plaintext connections between services. On GCP load balancers, attach an explicit SSL policy with minimum TLS 1.2 (MODERN or RESTRICTED profile); with no policy attached, the default is the COMPATIBLE profile with minimum TLS 1.0. |
| Secrets | Never in environment variables directly. Reference secrets store ARN/URI only. On GCP Cloud Run, prefer Secret Manager volume mounts: env vars are resolved once at instance startup, while mounts fetch the latest version. |
| Processed documents (output) | Encrypted at rest in output storage. Encryption key separate from input storage key. |

## Secrets management

- All credentials are stored in the cloud-native secrets store (AWS Secrets Manager / Azure Key Vault / GCP Secret Manager).
- Secret names follow a consistent naming convention: `<env>/<component>/<credential-type>` (e.g. `prod/api-gateway/client-secret`).
- Secret rotation: document the expected rotation interval and the rotation mechanism (automatic where supported). On GCP, Secret Manager rotation schedules only publish a `SECRET_ROTATE` message to a Pub/Sub topic; a subscriber (function or job) must perform the actual rotation, so include that component in the design.
- No secrets in source code, container images, Terraform state, or architecture documents.

## Audit logging

- Every service emits structured logs to the central logging service (CloudWatch Logs / Azure Monitor Logs / Cloud Logging).
- Log entries must include: a correlation/request ID, the processing stage or operation, timestamp, outcome, and error code — never payload content that may contain sensitive data.
- API calls to external integrations are logged with request ID, endpoint, status code, and latency.
- Audit logs are immutable and retained per the enterprise retention policy (document in spec if known; default: 90 days). On GCP, retention is set per log bucket: `_Required` holds Admin Activity and System Event logs for a fixed 400 days, `_Default` keeps logs 30 days unless changed. Configure custom bucket retention (and bucket locking if required) to meet the policy.
- CloudTrail / Activity Log / Cloud Audit Logs enabled for all cloud API calls. On GCP, Admin Activity logs are always on, but Data Access audit logs are disabled by default for all services except BigQuery; explicitly enable them for in-scope services.

## Data governance

- If the spec identifies data that may contain PII or sensitive information, the architecture must show where scanning or masking occurs and document the handling policy.
- Enterprise data classification labels (if provided in spec) apply to all output tables and storage buckets.
- Data residency constraints (if provided in spec) must be reflected in region selection for all services.
