# PulseDB — Air-Gapped Installation

This runbook installs PulseDB in an environment with **no outbound internet
access**. Every artifact is pulled once on an internet-connected host, moved
across a physical boundary, then loaded into the isolated network.

If you just need a self-hosted install with internet, follow `docs/runbooks/SELF_HOST.md`
instead — this document is strictly for disconnected environments (classified
networks, regulated banking, some hospital systems, etc.).

## Prerequisites

In the restricted environment, you must already have:

- A Kubernetes cluster (v1.26+) OR a host with Docker 24+.
- A private container registry reachable from the cluster (Harbor, Quay,
  ECR, GCR, ACR — anything that speaks the Docker Registry v2 API).
- A Postgres 14+ database reachable from where PulseDB will run.
- A file-transfer mechanism across the boundary: a cross-domain guard,
  approved USB enclosure, etc.
- `helm` 3.12+ and `kubectl` installed on a jump host.

You must also have reviewed and approved:

- The PulseDB container image (cryptographically signed — see §3 below).
- The Helm chart manifests (rendered YAML, checked into your GitOps repo).
- The DB migration scripts (`backend/db/migrations/*.sql`).

## 1. Collect artifacts on the internet-connected staging host

```bash
# Pin the version you're going to push to production.
PULSEDB_VERSION=1.0.0

# 1a. Pull the container image and save it to a tarball.
docker pull pulsedb/pulsedb:${PULSEDB_VERSION}
docker save pulsedb/pulsedb:${PULSEDB_VERSION} -o pulsedb-${PULSEDB_VERSION}.tar

# 1b. Package the Helm chart.
helm package deploy/helm/pulsedb -d .

# 1c. Verify the image signature (cosign). Save the signature bundle.
cosign verify pulsedb/pulsedb:${PULSEDB_VERSION} \
    --certificate-identity-regexp '.*@pulsedb.dev$' \
    --certificate-oidc-issuer https://accounts.google.com \
    > pulsedb-${PULSEDB_VERSION}.signature.txt

# 1d. Collect SBOM (for your software-supply-chain audit).
cosign download sbom pulsedb/pulsedb:${PULSEDB_VERSION} > pulsedb-${PULSEDB_VERSION}.sbom.json

# 1e. Export the migration set.
tar czf pulsedb-${PULSEDB_VERSION}-migrations.tar.gz backend/db/migrations
```

Artifacts to transport:

- `pulsedb-${PULSEDB_VERSION}.tar`
- `pulsedb-${PULSEDB_VERSION}.tgz` (chart)
- `pulsedb-${PULSEDB_VERSION}.signature.txt`
- `pulsedb-${PULSEDB_VERSION}.sbom.json`
- `pulsedb-${PULSEDB_VERSION}-migrations.tar.gz`

## 2. Transport and validate

Move the files across the boundary per your organisation's procedure. On
the air-gapped side, re-verify each file's SHA-256 against the manifest you
signed at staging.

```bash
sha256sum -c pulsedb-${PULSEDB_VERSION}.sha256.manifest
```

## 3. Push the image to your private registry

```bash
docker load -i pulsedb-${PULSEDB_VERSION}.tar
docker tag pulsedb/pulsedb:${PULSEDB_VERSION} \
    registry.internal.corp/pulsedb/pulsedb:${PULSEDB_VERSION}
docker push registry.internal.corp/pulsedb/pulsedb:${PULSEDB_VERSION}
```

## 4. Run the database migrations

```bash
tar xzf pulsedb-${PULSEDB_VERSION}-migrations.tar.gz
for f in backend/db/migrations/*.sql; do
    echo "Applying $f"
    psql "$DATABASE_URL" -f "$f"
done
```

## 5. Install the chart

Write a `values.airgapped.yaml` that points at your private registry:

```yaml
image:
    repository: registry.internal.corp/pulsedb/pulsedb
    tag: 1.0.0
    pullPolicy: IfNotPresent

imagePullSecrets:
    - name: registry-internal-corp-pullsecret

database:
    existingSecret: pulsedb-db-secret # kubectl-created; keys: DATABASE_URL

secrets:
    existingSecret: pulsedb-core-secret # keys: JWT_SECRET, ENCRYPTION_KEY

kms:
    backend: local # or 'vault' if you run Vault internally

observability:
    prometheusScrape: true
    otlpIngest: true

# No outbound — disable the AI copilot and any ingest-hitting-cloud defaults.
env:
    PULSEDB_AI_DISABLED: 'true'
    PULSEDB_OUTBOUND_ALLOWLIST: '' # empty = refuse outbound integrations
```

Install:

```bash
helm install pulsedb pulsedb-${PULSEDB_VERSION}.tgz \
    --namespace pulsedb --create-namespace \
    -f values.airgapped.yaml
```

## 6. Post-install smoke checks

```bash
kubectl -n pulsedb port-forward svc/pulsedb 5000:5000 &

curl -sf http://localhost:5000/api/health | jq '.diagnostics'
curl -sf http://localhost:5000/metrics   | head -20
```

Both should succeed and the health diagnostic should report
`"ok": true` — if not, the blockers will be on the JSON in the
`diagnostics.blockers` array.

Run the doctor in a one-shot pod:

```bash
kubectl -n pulsedb run pulsedb-doctor --rm -it --restart=Never \
    --image=registry.internal.corp/pulsedb/pulsedb:${PULSEDB_VERSION} \
    -- node backend/scripts/doctor.js
```

## 7. Upgrades

1. Re-run §1 on the staging host for the new version.
2. Transport artifacts.
3. `helm upgrade pulsedb pulsedb-<new>.tgz -n pulsedb -f values.airgapped.yaml`.
4. Migrations are idempotent; re-apply them the same way.

## 8. Known limitations in air-gapped mode

- **AI copilot**: disabled — no path to reach an LLM.
- **Slack / PagerDuty / Opsgenie webhooks**: require outbound — configure
  your own internal bridge or use email only.
- **Plugin marketplace**: disabled by default in air-gapped mode. Install
  plugins from the local filesystem instead.
- **Auto-update checks**: disabled. Subscribe to the PulseDB release
  mailing list for out-of-band notifications.
