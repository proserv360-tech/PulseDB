# IaC Drift Runbook

**Owner:** Platform / SRE
**Related control:** SOC 2 CC8.1 (change management), CC7.1 (monitoring of controls)
**Related workflow:** `.github/workflows/security.yml` → job `iac-drift`

---

## What drift means for FATHOM

"Infrastructure drift" is any difference between the rendered output of our
infrastructure-as-code sources (Kustomize overlays, Helm charts, `docker-compose.yml`,
Terraform plans) and the state committed in `.iac-baseline/`. Drift is not
automatically bad — many drifts are intentional deployment changes that
simply haven't been re-baselined. The point of tracking drift is so that
_every_ change is visible in a pull request, and so nothing silently changes
in production without review.

For SOC 2 we need to demonstrate that infrastructure changes:

1. go through code review,
2. produce an audit trail,
3. are reviewable against the previous known-good state.

The `iac-drift` workflow provides (2) and (3). (1) is enforced by branch
protection on `main`.

---

## How the workflow operates

The workflow runs in three situations:

- Nightly on `schedule` — so drift introduced out of band (via `kubectl
apply`, Helm upgrade from a laptop, etc.) surfaces within a day.
- On `push` to `main` or `develop`.
- On pull requests that touch `deploy/`, `infra/`, or `docker-compose*`.

It renders:

- Kustomize overlays under `deploy/k8s/overlays/*`
- Helm charts under `deploy/helm/*`
- Compose files at repo root via `docker compose config`

…and writes them into `.iac-snapshot/`. If `.iac-baseline/` exists, it
diffs the two and writes `iac-drift.diff`, uploading both as a GitHub
Actions artefact (30-day retention).

A non-empty diff is surfaced as a job warning and posted into the run
summary. It does **not** fail the job — drift needs review, not automatic
rejection. The baseline promotion below is the explicit action that
"accepts" a drift.

---

## Establishing the baseline (first-time setup)

1. Run the workflow manually or wait for a scheduled run to produce
   `.iac-snapshot/`.
2. Download the artefact, extract it, and commit its contents as
   `.iac-baseline/` on a branch:
    ```
    mkdir -p .iac-baseline
    cp -r iac-snapshot/* .iac-baseline/
    git add .iac-baseline
    git commit -m "chore(infra): establish IaC baseline"
    ```
3. Open a PR titled `chore(infra): establish IaC baseline`. Two
   reviewers sign off, including one platform owner.
4. After merge, subsequent drift runs produce diffs against this
   baseline.

---

## Handling a drift finding (routine)

When the nightly job reports drift:

1. Download `iac-drift-<run_id>.zip` from the failed run.
2. Inspect `iac-drift.diff`. Classify the drift into one of:
    - **Intentional** (someone landed a chart change but forgot to
      update the baseline). → Follow "Re-baseline a legitimate change"
      below.
    - **Unintentional** (someone `kubectl apply`ed a hotfix from a
      laptop). → Follow "Out-of-band change" below.
    - **Unknown / suspicious**. → Treat as a potential incident; escalate
      per `docs/runbooks/incident-response.md`.

### Re-baseline a legitimate change

If the drift came from a merged PR that updated the charts but left
`.iac-baseline/` stale:

1. Create a branch `baseline/<short-description>`.
2. Copy the current `.iac-snapshot/` output into `.iac-baseline/`,
   **replacing** the files that drifted.
3. Open a PR. The PR description must link the original change PR so
   the audit trail is continuous. Example description:

    > Re-baseline after #1473 (upgrade of `deploy/helm/fathom-backend`
    > from 1.4.2 → 1.5.0). Drift diff attached; all changes are
    > expected image-tag and resource-limit updates.

4. Two approvals required. Merge.

### Out-of-band change

If `kubectl apply` or an interactive `helm upgrade` changed the cluster
without a corresponding commit:

1. Do **not** re-baseline. That would legitimise an un-reviewed change.
2. File an incident ticket with the drift artefact attached.
3. Revert the cluster to the state described by the committed IaC.
4. If the change was genuinely needed, open a PR to the IaC sources,
   let it go through review, and merge. Then re-baseline per above.

---

## Handling a drift finding on a pull request

When a PR touches `deploy/`, the workflow produces a drift diff against
the committed baseline. Reviewers should:

1. Confirm the PR description explains the drift.
2. Check the drift matches what the PR claims to change (no extra,
   unexplained diffs).
3. Require the PR to also update `.iac-baseline/` in the same commit —
   so the baseline moves atomically with the source change.

---

## Scope and limitations

- **Cluster-side state is not rendered.** Drift shown here is "source
  intent" drift, not "live cluster" drift. Live drift detection
  (`kubectl diff`) is a separate capability and is not yet wired into
  CI.
- **Terraform** is rendered via `terraform plan` only if `infra/`
  contains a `.tf` file and a backend is reachable from CI. Our current
  deploy is fully Kustomize + Helm, so this is a placeholder.
- **Secrets** are excluded by Kustomize's
  `secretGenerator(options.disableNameSuffixHash)` and Helm's
  `--set-file` indirection. Baseline diffs will never contain
  plaintext secret material.

---

## Control mapping

| Requirement | How this workflow satisfies it                                                              |
| ----------- | ------------------------------------------------------------------------------------------- |
| SOC 2 CC8.1 | Every infra change appears as a diff in PR review. Nightly run catches out-of-band changes. |
| SOC 2 CC7.1 | Drift artefacts retained 30 days; auditor can sample any run.                               |
| SOC 2 CC6.8 | Secrets are not part of rendered output; drift artefacts do not leak credentials.           |
