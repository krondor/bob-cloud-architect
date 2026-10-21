<!-- load when: designing component selection, producing cloud-specific architecture diagrams, or any task involving service selection across AWS / Azure / GCP -->

# Multi-Cloud Parity

Every architecture output covers AWS, Azure, and GCP with equal depth unless the active spec explicitly reduces scope.

## Mapping table

When recommending services, always produce a three-column mapping:

| Capability | AWS | Azure | GCP |
|---|---|---|---|
| Object storage | S3 | Blob Storage | Cloud Storage |
| Event notification | EventBridge / S3 Event Notifications | Event Grid | Eventarc |
| Messaging queue | SQS | Service Bus Queue | Pub/Sub |
| Serverless compute | Lambda | Azure Functions | Cloud Functions / Cloud Run |
| Secrets management | Secrets Manager | Key Vault | Secret Manager |
| KMS | KMS | Key Vault (keys) | Cloud KMS |
| Container registry | ECR | ACR | Artifact Registry |
| Monitoring | CloudWatch | Azure Monitor | Cloud Monitoring |
| Distributed tracing | X-Ray | Application Insights | Cloud Trace |
| VPC networking | VPC | VNet | VPC |
| Private endpoints | PrivateLink | Private Endpoint | Private Service Connect |

Extend this table with domain-specific services required by the active spec.

## Cloud-agnostic abstractions first

State the cloud-agnostic pattern (e.g. "object store → event notification → queue → serverless validator") before rendering cloud-specific implementations. This makes the architecture readable across cloud teams and satisfies the multi-cloud scoring criterion.

## Avoiding cloud-lock reasoning

When a capability exists natively on all three clouds with comparable maturity and cost, recommend the native service per cloud. Only recommend a cloud-agnostic middleware layer (e.g. Kafka, Pulsar) when there is a stated operational requirement for it. Document the rationale either way.
