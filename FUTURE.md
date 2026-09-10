# Future Roadmap: Oracle Cloud + Kubernetes Deployment Guide

This document outlines the step-by-step roadmap for taking the **Money Tracker** application from local Docker Compose to a production-ready, self-hosted Kubernetes cluster on **Oracle Cloud Infrastructure (OCI) Always Free Tier**.

---

## 🎯 Architectural Overview

```
                               ┌────────────────────────────────────────────────────────┐
                               │             Oracle Cloud Always Free VM                │
                               │           (4 OCPU, 24 GB RAM - K3s Cluster)            │
                               │                                                        │
[ User Browser ] ───(HTTPS)───►│  ┌──────────────────────────────────────────────────┐  │
                               │  │           Nginx Ingress Controller               │  │
                               │  │      (Cert-Manager / Let's Encrypt SSL)          │  │
                               │  └────────────────────────┬─────────────────────────┘  │
                               │                           │                            │
                               │             ┌─────────────┴─────────────┐              │
                               │             ▼                           ▼              │
                               │  ┌────────────────────┐    ┌────────────────────────┐  │
                               │  │ Money Tracker App  │    │   MariaDB StatefulSet  │  │
                               │  │    (2 Replicas)    │───►│  (PersistentVolume)    │  │
                               │  └────────────────────┘    └────────────────────────┘  │
                               └────────────────────────────────────────────────────────┘
                                                           ▲
                                                           │ (Automated Deployment)
                                                           │
                                             ┌─────────────┴────────────┐
                                             │   GitHub Actions CI/CD   │
                                             │ (ghcr.io Docker Registry)│
                                             └──────────────────────────┘
```

---

## 📋 End-to-End Learning Objectives

By deploying this stack, you will gain hands-on experience with:
1. **Cloud Computing**: Provisioning OCI Compute, Virtual Cloud Networks (VCN), Ingress Security Rules.
2. **Container Orchestration**: Running K3s (lightweight Kubernetes) on Linux.
3. **Infrastructure as Code**: Managing deployments via Kubernetes Manifests (`k8s/` directory).
4. **CI/CD Automation**: GitHub Actions building ARM64/AMD64 multi-arch images on `git push`.
5. **Production Security**: Encrypted secrets, non-root Docker execution, rate-limiting, and Let's Encrypt SSL certificates.

---

## 🚀 Step-by-Step Implementation Roadmap

### Phase 1: Oracle Cloud Infrastructure (OCI) Setup
- [ ] Create an **Oracle Cloud Always Free** account.
- [ ] Create a Compute Instance:
  - **Shape**: Ampere A1 ARM (`VM.Standard.A1.Flex`) with **4 OCPUs** and **24 GB RAM**.
  - **OS**: Ubuntu 22.04 LTS or Oracle Linux 9.
  - **Disk**: 100 GB Boot Volume.
- [ ] Configure OCI Security List (Virtual Cloud Network):
  - Ingress Rule: Allow port `80` (HTTP) from `0.0.0.0/0`.
  - Ingress Rule: Allow port `443` (HTTPS) from `0.0.0.0/0`.
  - Ingress Rule: Allow port `22` (SSH) from your IP.

### Phase 2: Server & K3s Kubernetes Installation
- [ ] SSH into the Oracle Cloud VM.
- [ ] Install K3s (production-ready lightweight Kubernetes):
  ```bash
  curl -sfL https://get.k3s.io | sh -
  sudo chmod 644 /etc/rancher/k3s/k3s.yaml
  ```
- [ ] Verify node & cluster health:
  ```bash
  kubectl get nodes
  ```

### Phase 3: CI/CD Pipeline & Image Registry
- [ ] Enable GitHub Container Registry (GHCR) in your GitHub repository.
- [ ] Ensure `.github/workflows/ci.yml` builds and pushes multi-platform Docker images (`ghcr.io/<your-username>/money-tracker:latest`).
- [ ] Create a Kubernetes Docker Registry secret on the VM:
  ```bash
  kubectl create secret docker-registry ghcr-secret \
    --namespace=money-tracker \
    --docker-server=ghcr.io \
    --docker-username=<your-github-username> \
    --docker-password=<your-github-token>
  ```

### Phase 4: Deploying Manifests
Apply pre-configured manifests from the `k8s/` folder:

```bash
# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. Base64 Secrets & ConfigMap
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

# 3. MariaDB Database (Wait for status Ready)
kubectl apply -f k8s/mariadb.yaml
kubectl -n money-tracker wait --for=condition=ready pod -l app=money-tracker-db --timeout=120s

# 4. App Deployment & Persistent Storage Claims
kubectl apply -f k8s/app.yaml

# 5. Ingress Controller & Network Policies
kubectl apply -f k8s/ingress.yaml
```

### Phase 5: Domain & Free SSL (Let's Encrypt)
- [ ] Point your custom domain / DuckDNS to the Oracle Cloud Public IP.
- [ ] Install `cert-manager` on K3s:
  ```bash
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
  ```
- [ ] Configure `ClusterIssuer` for automated Let's Encrypt TLS certificates.

---

## 📁 Repository Pre-configured Resources

The codebase already contains all necessary manifests:

| Folder / File | Purpose |
|---------------|---------|
| `k8s/namespace.yaml` | Isolated `money-tracker` namespace |
| `k8s/secret.yaml` | Base64 encoded secrets matching `.env` |
| `k8s/configmap.yaml` | Environment configuration variables |
| `k8s/mariadb.yaml` | MariaDB StatefulSet with 5GB PersistentVolumeClaim |
| `k8s/app.yaml` | App Deployment (2 replicas, HPA 2-5 pods, PVC for backups & health reports) |
| `k8s/ingress.yaml` | Nginx Ingress routing, rate limiting, and network isolation policy |
| `nginx/nginx.conf` | Reverse proxy configuration |
| `.github/workflows/ci.yml` | Automated build & test workflow |

---

*Keep this document as the reference guide when you begin setting up Oracle Cloud!*
