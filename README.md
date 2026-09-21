# UrbanSync — Your Building, Simplified

**A cloud-native building management platform** for property managers and tenants — tracking shared expenses, monitoring IoT sensor telemetry, and using AI to auto-annotate uploaded receipts.

> 📘 **Full documentation lives in [`urbansync-v2/README.md`](urbansync-v2/README.md)** — architecture diagrams, Kubernetes bootstrap steps, Knative serverless setup, the CI/CD pipeline (Jenkins + ArgoCD), secrets management, and troubleshooting.

---

## Technology Stack

| Component | Technology | Role |
|---|---|---|
| **Frontend** | React 18 + Nginx | SPA |
| **Backend** | Node.js 20 + Express | REST API, file upload proxy, alarm consumer |
| **Database** | MongoDB 7 | Application data, notifications |
| **Message Broker** | RabbitMQ 3 | Building alarms, MinIO event fan-out |
| **Object Storage** | MinIO | Receipt storage (S3-compatible) |
| **IoT Platform** | ThingsBoard CE | Sensor telemetry, dashboards, rule engine |
| **Flow Orchestration** | Node-RED | IoT device simulation, alarm rule chains |
| **Serverless** | Knative Serving | AI receipt annotation via Google Gemini |
| **CI/CD** | Jenkins + ArgoCD | Build → push → GitOps sync |
| **Orchestration** | Kubernetes (kubeadm) | Single-node cluster on Azure |

---

## Repository Layout

- [`urbansync-v2/`](urbansync-v2/) — current production codebase: frontend, backend, the Knative serverless function, Kubernetes manifests, and Ansible/OpenTofu infrastructure-as-code
- [`docs/legacy/`](docs/legacy/) — earlier design docs and the original v1 local-development setup, kept for historical reference

---

## Getting Started

For architecture, deployment commands, secrets configuration, and the CI/CD pipeline, go to **[`urbansync-v2/README.md`](urbansync-v2/README.md)**.

Looking for the original single-process v1 setup (local Node.js + MongoDB)? See [`docs/legacy/V1_LOCAL_SETUP.md`](docs/legacy/V1_LOCAL_SETUP.md).
