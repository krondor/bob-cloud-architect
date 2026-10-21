<!-- always active -->

# Deliverable Format

Every architecture deliverable follows this structure. Missing sections are explicitly noted as
out-of-scope with a rationale, not silently omitted.

## Required sections

```
1. Overview
   - Business problem (one paragraph, sourced from spec)
   - Scope: clouds, integrations, phases

2. High-Level Architecture
   - Cloud-agnostic component diagram (Mermaid flowchart, L1 + L2)
   - Processing sequence (Mermaid sequenceDiagram)

3. Cloud-Specific Architecture
   - AWS variant (Mermaid flowchart with AWS service names)
   - Azure variant (Mermaid flowchart with Azure service names)
   - GCP variant (Mermaid flowchart with GCP service names)

4. Component Selection Matrix
   Table: Capability | AWS | Azure | GCP | Rationale | Cost Model
   *** Cost Model column is MANDATORY — never omit ***

5. Enterprise Integration Architecture
   - One subsection per integration target in the spec
   - Each: connection mechanism, auth model, data flow, failure behavior, observability, data governance

6. Failure Handling Design
   - Retry strategy: max attempts, backoff algorithm (exponential + jitter), jitter range
   - DLQ design: routing, alert threshold (depth and age), reprocessing trigger
   - Recovery runbook pointer

7. High Availability and Disaster Recovery
   - RPO/RTO targets (open decisions if not in spec)
   - HA pattern with rationale
   - Multi-region topology diagram (Mermaid)
   - Data residency mapping
   - Failover runbook pointer
   Omit only if spec explicitly excludes HA/DR; state rationale.

8. Security Design
   - IAM/RBAC matrix (one role per component — never shared roles)
   - Encryption table (at rest: KMS CMK; in transit: TLS 1.3)
   - Secrets management plan (naming convention, rotation interval, rotation mechanism)
   - Audit logging design (log fields, retention policy, immutability)
   - PII sanitization point (where PII is scanned and masked before LLM invocation)

9. Data Model
   - Document status state machine (Mermaid stateDiagram-v2)
   - Status tracking / reconciliation ledger DDL (SQL)
   - Output schemas for integration targets (Parquet/Iceberg DDL or JSON Schema)

10. Downstream Handoff Contracts
    a. Ingestion event schema — CloudEvents format, JSON Schema:
       {
         "specversion": "1.0",
         "type": "com.enterprise.doc.ingested",
         "source": "<storage-uri>",
         "id": "<correlation_id>",
         "datacontenttype": "application/json",
         "data": {
           "doc_id": "<uuid>",
           "sha256_checksum": "<hex>",
           "storage_uri": "<s3|blob|gcs uri>",
           "doc_type": "<string>",
           "ingestion_ts": "<ISO-8601>"
         }
       }

    b. Reconciliation ledger DDL — see 03-enterprise-integrations.md for full schema

    c. Processed summary output schema (Iceberg DDL):
       CREATE TABLE processed_summaries (
         doc_id          STRING        NOT NULL,
         batch_id        STRING,
         summary_text    STRING        NOT NULL,
         model_id        STRING        NOT NULL,
         prompt_version  STRING        NOT NULL,
         ingestion_date  DATE          NOT NULL,   -- hidden partition column
         doc_type        STRING        NOT NULL,   -- hidden partition column
         processed_ts    TIMESTAMP     NOT NULL
       ) USING ICEBERG
       PARTITIONED BY (days(ingestion_date), doc_type);

    d. AI prompt specification — `prompts/document_summary_prompt.yaml`:
       prompt_id: document_summary_v1
       model_fallback_hierarchy:
         - <primary model id>
         - <fallback model id>
       hyperparameters:
         temperature: 0.2
         max_output_tokens: 512
         stop_sequences: ["\n\n"]
       prompt_template: |
         Summarize the following document. Focus on key findings and action items.
         Metadata: {{metadata}}
         Document text: {{document_text}}
       variable_injection:
         - name: document_text
           source: validated_document_body
           max_chars: 8000
           truncation_strategy: tail
         - name: metadata
           source: reconciliation_ledger
           fields: [doc_id, doc_type, ingestion_ts]

11. Target Project Folder Structure
    src/
      ingestion/
      validation/
      batching/
      llm_engine/
      adapters/
        snowflake/
        databricks/
        iceberg/
        ccl/
      reconciliation/
    terraform/
      aws/
      azure/
      gcp/
    tests/
      unit/
      integration/
      failure_scenarios/
    prompts/
      document_summary_prompt.yaml
    docs/
    README.md

12. Implementation Plan
    - Ordered phases with dependencies
    - Hand-off criteria to downstream modes (agent mode for code, IaC mode for Terraform)

13. Open Decisions
    - Unresolved items requiring human input before implementation
    - Owner and target resolution date
```

## Diagram conventions

- `subgraph` for system boundaries (cloud region, enterprise network, external system)
- Label every arrow with data type or event name
- Failure paths: dashed arrows `-.->` 
- Consistent node naming: `ServiceName["ServiceName\n(AWS/Azure/GCP)"]`

## Tables

Prefer tables over bullet lists for comparisons, matrices, and multi-attribute descriptions.
Prose for explanations. Code blocks for schemas, configs, and directory trees.

## Output location

- Architecture documents: `docs/<spec-id>-<artifact-name>.md`
- Component selection matrix: `docs/component-matrix.md` (canonical hand-off artifact for downstream modes)
- Prompt specification: `prompts/document_summary_prompt.yaml` (or as a code block in the deliverable)
