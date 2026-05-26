# UrbanSync v2 — Cloud-Native Migration

A cloud-native transformation of the UrbanSync apartment management platform.

## Architecture Overview

```
urbansync-v2/
├── frontend/          React SPA + Nginx (multi-stage Docker build)
├── backend/           Node.js REST API (self-contained — all modules inside)
│   ├── controllers/   Request handlers
│   ├── models/        Mongoose schemas
│   ├── middleware/    Auth middleware
│   ├── services/      CloudService (MinIO + RabbitMQ)
│   ├── workers/       Background processors
│   └── config/        Service configs (MinIO, RabbitMQ)
├── k8s/               Kubernetes manifests (managed by ArgoCD)
│   ├── frontend/      Deployment + Service
│   ├── backend/       Deployment + Service
│   ├── mongodb/       StatefulSet + Service + PVC
│   ├── rabbitmq/      StatefulSet + Service + PVC
│   ├── minio/         StatefulSet + Service + PVC
│   ├── thingsboard/   StatefulSet + Service + PVCs
│   └── nodered/       Deployment + Service + PVC
└── infrastructure/
    ├── jenkins/       CI/CD — builds images, updates manifest tags
    ├── argocd/        GitOps — watches k8s/ and syncs the cluster
    ├── registry/      Local container registry (registry:2)
    ├── opentofu/      IaC — Azure VM provisioning
    └── ansible/       Configuration management
```

## Roadmap

| Phase | Component | Status |
|-------|-----------|--------|
| 1 | Project restructuring (this) | ✅ Done |
| 2 | GitOps — Jenkins CI/CD + ArgoCD | ✅ Done |
| 3 | Kubernetes manifests (Docker Desktop K8s) | ✅ Done |
| 4 | IaC — OpenTofu + Ansible (Azure VM) | ✅ Done |
| 5 | Serverless — OpenWhisk (MinIO triggers) | 🔜 |
| 6 | Design Patterns — Circuit Breaker, Idempotency, Retry | 🔜 |
| 7 | Monitoring — Prometheus + Grafana + HPA | 🔜 |

## Key Fix from v1
The v1 project had `controllers/`, `models/`, and `middleware/` at the **repo root**,
mounted into the container via Docker volume mounts. This was incompatible with
Kubernetes. In v2, all modules live **inside** `backend/`, making the image fully
self-contained and Kubernetes-ready.
