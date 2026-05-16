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
├── k8s/               Kubernetes manifests (Docker Desktop)
│   ├── frontend/      Deployment + Service
│   ├── backend/       Deployment + Service
│   ├── mongodb/       StatefulSet + Service + PVC
│   ├── rabbitmq/      StatefulSet + Service + PVC
│   ├── minio/         StatefulSet + Service + PVC
│   ├── thingsboard/   StatefulSet + Service + PVCs
│   └── nodered/       Deployment + Service + PVC
└── infrastructure/
    ├── jenkins/       CI/CD — Jenkins with Docker + kubectl
    ├── registry/      Local container registry (registry:2)
    ├── opentofu/      IaC — Azure VM provisioning
    └── ansible/       Configuration management
```

## Roadmap

| Phase | Component | Status |
|-------|-----------|--------|
| 1 | Project restructuring (this) | ✅ Done |
| 2 | GitOps — Jenkins CI/CD (local registry + Docker Compose) | ✅ Done |
| 3 | Kubernetes manifests (Docker Desktop K8s) | ✅ Done |
| 4 | Serverless — OpenWhisk (MinIO triggers) | 🔜 |
| 5 | Design Patterns — Circuit Breaker, Idempotency, Retry | 🔜 |
| 6 | Monitoring — Prometheus + Grafana + HPA | 🔜 |
| 7 | IaC — OpenTofu + Ansible (Azure VM) | 🔜 |

## Key Fix from v1
The v1 project had `controllers/`, `models/`, and `middleware/` at the **repo root**,
mounted into the container via Docker volume mounts. This was incompatible with
Kubernetes. In v2, all modules live **inside** `backend/`, making the image fully
self-contained and Kubernetes-ready.
