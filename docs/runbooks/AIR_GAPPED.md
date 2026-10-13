# FATHOM — Air-Gapped Installation

This runbook installs FATHOM in an environment with **no outbound internet
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
- A Postgres 14+ database reachable from where FATHOM will run.
- A file-transfer mechanism across the boundary: a cross-domain guard,
  approved USB enclosure, etc.
- `helm` 3.12+ and `kubectl` installed on a jump host.

You must also have reviewed and approved:

- The FATHOM container image (cryptographically signed — see §3 below).
- The Helm chart manifests (rendered YAML, checked into your GitOps repo).
- The DB migration scripts (`backend/db/migrations/*.sql`).

## 1. Collect artifacts on the internet-connected staging host

```bash
# Pin the version you're going to push to production.
FATHOM_VERSION=1.0.0

# 1a. Pull the container image and save it to a tarball.
docker pull fathom/fathom:${FATHOM_VERSION}
docker save fathom/fathom:${FATHOM_VERSION} -o fathom-${FATHOM_VERSION}.tar

# 1b. Package the Helm chart.
helm package deploy/helm/fathom -d .

# 1c. Verify the image signature (cosign). Save the signature bundle.
cosign verify fathom/fathom:${FATHOM_VERSION} \
    --certificate-identity-regexp '.*@fathom.dev$' \
    --certificate-oidc-issuer https://accounts.google.com \
    > fathom-${FATHOM_VERSION}.signature.txt

# 1d. Collect SBOM (for your software-supply-chain audit).
cosign download sbom fathom/fathom:${FATHOM_VERSION} > fathom-${FATHOM_VERSION}.sbom.json

# 1e. Export the migration set.
tar czf fathom-${FATHOM_VERSION}-migrations.tar.gz backend/db/migrations
```

Artifacts to transport:

- `fathom-${FATHOM_VERSION}.tar`
- `fathom-${FATHOM_VERSION}.tgz` (chart)
- `fathom-${FATHOM_VERSION}.signature.txt`
- `fathom-${FATHOM_VERSION}.sbom.json`
- `fathom-${FATHOM_VERSION}-migrations.tar.gz`

## 2. Transport and validate

Move the files across the boundary per your organisation's procedure. On
the air-gapped side, re-verify each file's SHA-256 against the manifest you
signed at staging.

```bash
sha256sum -c fathom-${FATHOM_VERSION}.sha256.manifest
```

## 3. Push the image to your private registry

```bash
docker load -i fathom-${FATHOM_VERSION}.tar
docker tag fathom/fathom:${FATHOM_VERSION} \
    registry.internal.corp/fathom/fathom:${FATHOM_VERSION}
docker push registry.internal.corp/fathom/fathom:${FATHOM_VERSION}
```

## 4. Run the database migrations

```bash
tar xzf fathom-${FATHOM_VERSION}-migrations.tar.gz
for f in backend/db/migrations/*.sql; do
    echo "Applying $f"
    psql "$DATABASE_URL" -f "$f"
done
```

## 5. Install the chart

Write a `values.airgapped.yaml` that points at your private registry:

```yaml
image:
    repository: registry.internal.corp/fathom/fathom
    tag: 1.0.0
    pullPolicy: IfNotPresent

imagePullSecrets:
    - name: registry-internal-corp-pullsecret

database:
    existingSecret: fathom-db-secret # kubectl-created; keys: DATABASE_URL

secrets:
    existingSecret: fathom-core-secret # keys: JWT_SECRET, ENCRYPTION_KEY

kms:
    backend: local # or 'vault' if you run Vault internally

observability:
    prometheusScrape: true
    otlpIngest: true

# No outbound — disable the AI copilot and any ingest-hitting-cloud defaults.
env:
    FATHOM_AI_DISABLED: 'true'
    FATHOM_OUTBOUND_ALLOWLIST: '' # empty = refuse outbound integrations
```

Install:

```bash
helm install fathom fathom-${FATHOM_VERSION}.tgz \
    --namespace fathom --create-namespace \
    -f values.airgapped.yaml
```

## 6. Post-install smoke checks

```bash
kubectl -n fathom port-forward svc/fathom 5000:5000 &

curl -sf http://localhost:5000/api/health | jq '.diagnostics'
curl -sf http://localhost:5000/metrics   | head -20
```

Both should succeed and the health diagnostic should report
`"ok": true` — if not, the blockers will be on the JSON in the
`diagnostics.blockers` array.

Run the doctor in a one-shot pod:

```bash
kubectl -n fathom run fathom-doctor --rm -it --restart=Never \
    --image=registry.internal.corp/fathom/fathom:${FATHOM_VERSION} \
    -- node backend/scripts/doctor.js
```

## 7. Upgrades

1. Re-run §1 on the staging host for the new version.
2. Transport artifacts.
3. `helm upgrade fathom fathom-<new>.tgz -n fathom -f values.airgapped.yaml`.
4. Migrations are idempotent; re-apply them the same way.

## 8. Known limitations in air-gapped mode

- **AI copilot**: disabled — no path to reach an LLM.
- **Slack / PagerDuty / Opsgenie webhooks**: require outbound — configure
  your own internal bridge or use email only.
- **Plugin marketplace**: disabled by default in air-gapped mode. Install
  plugins from the local filesystem instead.
- **Auto-update checks**: disabled. Subscribe to the FATHOM release
  mailing list for out-of-band notifications.
