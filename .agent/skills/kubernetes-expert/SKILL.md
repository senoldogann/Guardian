---
name: kubernetes-expert
description: Kubernetes deployment, management, and troubleshooting. Container orchestration best practices, manifests, Helm charts, and production operations.
allowed-tools: Read, Glob, Grep, Bash
---

# Kubernetes Expert Skill

> Master Kubernetes deployment, management, and operations.
> **Principles-first approach - understand WHY, not just HOW.**

---

## ⚠️ How to Use This Skill

This skill teaches Kubernetes principles and patterns:

- Understand resource types and their purposes
- Apply appropriate patterns for your use case
- Troubleshoot systematically

---

## 1. Architecture Fundamentals

### Control Plane Components

| Component | Purpose |
|-----------|---------|
| **kube-apiserver** | All cluster operations go through here |
| **etcd** | Cluster state storage |
| **kube-scheduler** | Places pods on nodes |
| **kube-controller-manager** | Runs controller loops |
| **cloud-controller-manager** | Cloud provider integration |

### Node Components

| Component | Purpose |
|-----------|---------|
| **kubelet** | Runs pods on node |
| **kube-proxy** | Network rules for Services |
| **Container Runtime** | Runs containers (containerd, CRI-O) |

---

## 2. Core Resources

### Workload Resources

```yaml
# Deployment - Stateless applications
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:v1.0.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Workload Type Selection

| Use Case | Resource Type |
|----------|---------------|
| Stateless apps | Deployment |
| Stateful apps (DBs) | StatefulSet |
| One pod per node | DaemonSet |
| Run-to-completion | Job |
| Scheduled tasks | CronJob |

---

## 3. Services & Networking

### Service Types

```yaml
# ClusterIP - Internal only (default)
apiVersion: v1
kind: Service
metadata:
  name: myapp-internal
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080

---
# NodePort - External via node port
apiVersion: v1
kind: Service
metadata:
  name: myapp-nodeport
spec:
  type: NodePort
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 30080  # 30000-32767

---
# LoadBalancer - Cloud load balancer
apiVersion: v1
kind: Service
metadata:
  name: myapp-lb
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

### Ingress (HTTP/HTTPS Routing)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp
            port:
              number: 80
```

---

## 4. Configuration Management

### ConfigMaps & Secrets

```yaml
# ConfigMap - Non-sensitive configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  LOG_LEVEL: "info"
  DB_HOST: "postgres.default.svc.cluster.local"
  config.json: |
    {
      "feature_flags": {
        "new_ui": true
      }
    }

---
# Secret - Sensitive data (base64 encoded)
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=  # echo -n "password123" | base64
  API_KEY: YWJjZGVmMTIzNDU2

---
# Using in Pod
spec:
  containers:
  - name: myapp
    envFrom:
    - configMapRef:
        name: myapp-config
    - secretRef:
        name: myapp-secrets
    # Or mount as files
    volumeMounts:
    - name: config-volume
      mountPath: /app/config
  volumes:
  - name: config-volume
    configMap:
      name: myapp-config
```

### External Secrets (Production Pattern)

```yaml
# Use external-secrets-operator for production
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: myapp-secrets
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: production/myapp/db
      property: password
```

---

## 5. Helm Charts

### Chart Structure

```
myapp-chart/
├── Chart.yaml          # Chart metadata
├── values.yaml         # Default values
├── values-prod.yaml    # Production overrides
├── templates/
│   ├── _helpers.tpl    # Template helpers
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   └── hpa.yaml
└── charts/             # Dependencies
```

### values.yaml Pattern

```yaml
# values.yaml
replicaCount: 2

image:
  repository: myapp
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  host: myapp.example.com
  tls: false

resources:
  requests:
    memory: 128Mi
    cpu: 100m
  limits:
    memory: 256Mi
    cpu: 500m

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilization: 80

env: {}
secrets: {}
```

### Helm Commands

```bash
# Install/upgrade
helm upgrade --install myapp ./myapp-chart \
  -f values-prod.yaml \
  --namespace production \
  --create-namespace

# Rollback
helm rollback myapp 1 --namespace production

# List releases
helm list --namespace production

# Get values
helm get values myapp --namespace production

# Diff before upgrade (requires helm-diff plugin)
helm diff upgrade myapp ./myapp-chart -f values-prod.yaml
```

---

## 6. Scaling & Autoscaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### Vertical Pod Autoscaler

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: Auto  # Or "Off" for recommendations only
```

---

## 7. Production Patterns

### Pod Disruption Budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
spec:
  minAvailable: 2  # Or maxUnavailable: 1
  selector:
    matchLabels:
      app: myapp
```

### Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-network-policy
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: frontend
    - podSelector:
        matchLabels:
          role: api-gateway
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

---

## 8. Deployment Strategies

### Rolling Update (Default)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%
```

### Blue-Green

```bash
# Deploy new version as separate deployment
kubectl apply -f deployment-v2.yaml

# Switch service to new version
kubectl patch service myapp -p '{"spec":{"selector":{"version":"v2"}}}'

# Rollback if needed
kubectl patch service myapp -p '{"spec":{"selector":{"version":"v1"}}}'
```

### Canary

```yaml
# Use Argo Rollouts or Flagger for automated canary
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 5m}
      - setWeight: 30
      - pause: {duration: 5m}
      - setWeight: 50
      - pause: {duration: 5m}
      - setWeight: 100
```

---

## 9. Troubleshooting

### Common Commands

```bash
# Pod status
kubectl get pods -o wide
kubectl describe pod <pod-name>
kubectl logs <pod-name> -f --tail=100
kubectl logs <pod-name> -c <container> --previous

# Events (sorted by time)
kubectl get events --sort-by='.lastTimestamp'

# Resource usage
kubectl top pods
kubectl top nodes

# Execute into pod
kubectl exec -it <pod-name> -- /bin/sh

# Port forward for debugging
kubectl port-forward pod/<pod-name> 8080:8080
kubectl port-forward svc/<service-name> 8080:80

# Get all resources in namespace
kubectl get all -n <namespace>
```

### Troubleshooting Decision Tree

```
Pod not running?
│
├── ImagePullBackOff
│   └── Check image name, registry auth, network
│
├── CrashLoopBackOff
│   └── Check logs, liveness probe, startup time
│
├── Pending
│   ├── Check resources (not enough CPU/memory)
│   ├── Check node selectors/affinity
│   └── Check PVC binding
│
├── OOMKilled
│   └── Increase memory limits
│
└── Not Ready
    └── Check readiness probe, dependencies
```

### Debug Pods

```yaml
# Ephemeral debug container (K8s 1.23+)
kubectl debug -it <pod-name> --image=busybox --target=<container>

# Debug node
kubectl debug node/<node-name> -it --image=ubuntu
```

---

## 10. GitOps Patterns

### ArgoCD Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/myapp-k8s.git
    targetRevision: main
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

### Kustomize Structure

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── overlays/
    ├── development/
    │   ├── kustomization.yaml
    │   └── patches/
    ├── staging/
    │   ├── kustomization.yaml
    │   └── patches/
    └── production/
        ├── kustomization.yaml
        └── patches/
```

---

## 11. Security Best Practices

### Pod Security

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
  - name: myapp
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
```

### Service Accounts

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp-sa
automountServiceAccountToken: false

---
# Assign to pod
spec:
  serviceAccountName: myapp-sa
  automountServiceAccountToken: false  # Unless needed
```

### RBAC

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
subjects:
- kind: ServiceAccount
  name: myapp-sa
  namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## 12. Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Use `latest` tag | Pin specific image versions |
| Skip resource requests/limits | Always set both |
| Run as root | Use non-root user |
| Skip probes | Always add liveness/readiness |
| Hardcode secrets | Use Secrets/external-secrets |
| Skip PDB | Add PodDisruptionBudget |
| Use NodePort for production | Use Ingress + LoadBalancer |
| Ignore resource quotas | Set namespace quotas |

---

## 13. Checklist

Before deploying to Kubernetes:

- [ ] Image version pinned (not `:latest`)
- [ ] Resource requests and limits set
- [ ] Liveness and readiness probes configured
- [ ] SecurityContext with non-root user
- [ ] Secrets managed externally (not in git)
- [ ] NetworkPolicy defined
- [ ] PodDisruptionBudget created
- [ ] HPA configured for scaling
- [ ] Ingress with TLS configured
- [ ] Monitoring and alerts set up
- [ ] Rollback plan ready

---

> **Remember:** Kubernetes gives you power with complexity. Master the fundamentals before adding more tools.
