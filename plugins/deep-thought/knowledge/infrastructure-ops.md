# Infrastructure Operations Patterns

Read this when reviewing, investigating, or working on infrastructure code — Terraform/OpenTofu, Helm charts, Kubernetes manifests, Dockerfiles, or ArgoCD configurations.

## Why This Matters

Infrastructure code has a unique failure mode: it looks correct in review but breaks in production. A missing security context, an unpinned image tag, or a misconfigured resource limit can pass every CI check and still cause an outage. Infrastructure review requires a different mental model than application code review.

## OpenTofu/Terraform Validation Pipeline

Run validations in this order — each stage catches different classes of errors:

| Stage | Command | What It Catches |
|-------|---------|----------------|
| **Format** | `tofu fmt -check` | Inconsistent formatting (catches merge conflict artifacts) |
| **Lint** | `tflint` | Provider-specific issues, deprecated syntax, naming violations |
| **Validate** | `tofu validate` | Configuration errors, missing variables, type mismatches |
| **Security** | `tfsec` or `checkov` | Hardcoded secrets, public access, missing encryption |
| **Plan** | `tofu plan` | State drift, unexpected changes, destruction of resources |

**Critical pattern:** Always review the plan output. `tofu apply` without reviewing the plan is the infrastructure equivalent of deploying without testing. Look specifically for:
- Resources being **destroyed** (the `-` prefix) — was this intentional?
- Resources being **replaced** (destroy + create) — will this cause downtime?
- Changes to IAM, networking, or encryption — these have blast radius beyond the immediate resource

## Helm Chart Validation Pipeline

| Stage | Command | What It Catches |
|-------|---------|----------------|
| **Lint** | `helm lint --strict` | Chart structure, missing required fields, template errors |
| **Template** | `helm template . --output-dir /tmp/out` | Render errors, incorrect value interpolation |
| **Schema** | `kubeconform -strict` on rendered output | Invalid K8s API fields, deprecated API versions |
| **Dry-run** | `helm install --dry-run=server` | Admission controller rejections, RBAC issues |
| **Security** | Manual review of rendered manifests | Security contexts, resource limits, image policies |

**Security checklist for Helm charts** [consensus]:
- Pod-level: `runAsNonRoot: true`, `runAsUser: 1000`, `fsGroup: 2000`
- Container-level: `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: [ALL]`
- Resource limits AND requests set for both CPU and memory
- Image tags pinned to specific versions — never `:latest`
- Liveness and readiness probes configured
- If `readOnlyRootFilesystem: true`, mount `emptyDir` for `/tmp` (many runtimes need writable temp)

## Kubernetes Debugging Patterns

**Diagnostic workflow — follow this order:**

1. **Pod status:** `kubectl get pods -o wide` — what state is the pod in?
2. **Events:** `kubectl describe pod <name>` — what happened? (focus on Events section at the bottom)
3. **Logs:** `kubectl logs <pod> [--previous] [-c <container>]` — what did the application say?
4. **Exec:** `kubectl exec <pod> -it -- /bin/sh` — inspect the running container

**Common failure patterns:**

| Symptom | Likely Cause | Investigation |
|---------|-------------|---------------|
| **CrashLoopBackOff** | Application crash on startup | Check logs with `--previous` flag; check resource limits |
| **Pending** | No node can schedule the pod | Check node resources, taints/tolerations, PVC binding |
| **ImagePullBackOff** | Image not found or auth failure | Verify image name/tag, check imagePullSecrets |
| **OOMKilled** | Memory limit exceeded | Increase memory limit or fix memory leak; check `kubectl top pod` |
| **Evicted** | Node under resource pressure | Check node conditions; set appropriate resource requests |
| **CreateContainerConfigError** | Bad ConfigMap/Secret reference | Verify ConfigMap/Secret exists in the same namespace |

**The `runAsNonRoot` trap:** If your Dockerfile uses `USER appuser` (named user), Kubernetes can't verify non-root status. Add `runAsUser: 1000` (numeric) to the security context. [strong — this is a common production issue]

## Dockerfile Best Practices

- **Multi-stage builds:** Separate builder from runtime. Builder has compilers and dev dependencies; runtime has only the application.
- **Non-root user:** Add `USER 1000` (numeric, not named) as the last user directive.
- **Minimal layers:** Combine related `RUN` commands. Each layer adds to image size.
- **Pin versions:** `FROM python:3.12.3-slim` not `FROM python:3`.
- **No secrets in layers:** Secrets in `RUN` or `COPY` persist in layer history even if deleted later. Use build secrets (`--mount=type=secret`).
- **`.dockerignore`:** Exclude `.git`, `node_modules`, `__pycache__`, `.env`, test fixtures.

## ArgoCD Sync Patterns

- **Auto-sync with self-heal:** For dev environments. Automatically corrects drift.
- **Manual sync:** For production. Requires explicit approval.
- **Sync windows:** Restrict production syncs to business hours or maintenance windows.
- **Health checks:** ArgoCD marks apps healthy only when all resources are ready. Custom health checks for CRDs.

**Troubleshooting sync failures:**
1. Check the ArgoCD UI diff — what's different between desired and live state?
2. Check application events: `argocd app get <app> --show-operation`
3. Common cause: resource modified outside ArgoCD (manual kubectl edit). Fix: let ArgoCD self-heal or manually sync.
4. Schema validation failures: API version deprecated or CRD not installed.

## Anti-patterns

- **`kubectl apply` in production without review.** Always `--dry-run=server` first, then review the diff.
- **Shared namespaces.** Separate workloads into namespaces by team or service. Shared namespaces make RBAC impossible.
- **Missing resource limits.** A pod without limits can consume an entire node's resources.
- **Hardcoded replicas in Helm values.** Use HPA (Horizontal Pod Autoscaler) for production workloads.
- **Ignoring pod disruption budgets.** Without PDBs, a node drain can take down all replicas simultaneously.
- **Skipping the dry-run.** "It's just a label change" — until it triggers a rolling restart.
