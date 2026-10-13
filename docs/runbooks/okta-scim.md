# Okta SCIM Provisioning for FATHOM

**Audience:** IT admin or identity engineer at a FATHOM Enterprise tenant.
**Prerequisite:** Your FATHOM tenant is on the Enterprise plan (SCIM is a
gated feature). You have at least one FATHOM admin account.

---

## What SCIM gives you

Automated, push-based user and group lifecycle from Okta:

- When a user is assigned to the FATHOM app in Okta, they appear in
  FATHOM with the right attributes.
- When a user is un-assigned or deactivated in Okta, they are
  deactivated in FATHOM (SCIM `active: false`).
- Group memberships pushed from Okta map to FATHOM roles.

No passwords cross the wire; authentication to FATHOM is still handled
via SAML SSO (`sso_saml` feature), which you configure separately.

---

## Step 1 — Mint a SCIM bearer token in FATHOM

1. Sign in to FATHOM as an admin.
2. Settings → Integrations → SCIM provisioning.
3. Click **Create token**. Label it `okta-prod` (or per-environment).
4. Copy the token — it's shown **once**. It starts with `fathom_scim_`.
5. Paste it into your password manager. You cannot recover it later;
   if you lose it, revoke it and mint a new one.

Behind the scenes, FATHOM stores only `SHA-256(token)`. The token itself
never touches disk in cleartext.

---

## Step 2 — Add the FATHOM app in Okta

1. Okta Admin → Applications → Browse App Catalog.
2. If a FATHOM entry exists, use it. Otherwise choose **Create New App →
   SWA or SAML 2.0** (any app shape — you're only using it as the
   carrier for SCIM here; SAML sign-in is configured separately).
3. On the **Provisioning** tab, click **Configure API Integration**.
4. Fill in:
    - **Base URL**: `https://<your-fathom-host>/scim/v2`
    - **API Token**: paste the `fathom_scim_...` token from Step 1.
5. Click **Test API Credentials**. Okta will issue a
   `GET /scim/v2/ServiceProviderConfig` — it must return 200.

If the test fails, check:

- The token hasn't been revoked (Settings → SCIM tokens).
- The URL is exactly `/scim/v2` (no trailing slash).
- Your FATHOM tenant is Enterprise — a 403 with `feature_not_available`
  means the feature gate is blocking the request.

---

## Step 3 — Configure provisioning

On the same **Provisioning** tab:

1. Enable:
    - **Create Users**
    - **Update User Attributes**
    - **Deactivate Users**
2. (Optional) enable **Push Groups** and add the groups you want
   provisioned.

### Attribute mappings

Okta → FATHOM SCIM Core 2.0 user schema. These map by default; verify on
the **Attribute Mappings** screen.

| Okta attribute | SCIM attribute          | Notes                                                       |
| -------------- | ----------------------- | ----------------------------------------------------------- |
| `login`        | `userName`              | Must be unique per tenant. Lowercased on write.             |
| `email`        | `emails[primary].value` | Primary email; used for notifications.                      |
| `firstName`    | `name.givenName`        |                                                             |
| `lastName`     | `name.familyName`       |                                                             |
| `displayName`  | `displayName`           | Optional; falls back to `firstName lastName`.               |
| `id`           | `externalId`            | Okta user id; lets FATHOM correlate after username changes. |

Leave `active` mapped to Okta's user status — that's what drives
deactivation.

### Group mapping (optional)

| Okta group       | FATHOM role |
| ---------------- | ----------- |
| `FATHOM-Admins`  | `admin`     |
| `FATHOM-DBAs`    | `dba`       |
| `FATHOM-Viewers` | `viewer`    |

FATHOM expects the group `displayName` to match one of the role names
above. Groups whose names don't match are created but not applied to
role policy.

---

## Step 4 — Assign and verify

1. Okta → **Assignments** tab → assign 1 or 2 test users.
2. Wait ~30 seconds (Okta batches SCIM calls).
3. In FATHOM → Settings → Users, confirm the users appear.
4. Un-assign one test user in Okta → confirm they show as inactive in
   FATHOM within a minute.

---

## Rotation and revocation

- Rotate the token every 90 days as a hygiene baseline (SOC 2 CC6.1).
- To rotate: mint a new token in FATHOM, update Okta's API Integration
  to use it, **then** revoke the old one. In that order — otherwise
  you'll interrupt the next scheduled sync.
- To emergency-revoke: Settings → SCIM tokens → Revoke. Okta's next
  sync will 401 immediately.

---

## Troubleshooting

| Symptom                        | Check                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `401 invalid or revoked token` | Token was rotated or revoked. Generate a new one; update Okta.                                                               |
| `403 feature_not_available`    | Tenant dropped off Enterprise. Contact your FATHOM CSM.                                                                      |
| New users not provisioning     | Confirm Okta's assignment rule actually includes them.                                                                       |
| Group memberships not syncing  | Push Groups must be explicitly enabled per group.                                                                            |
| `409 userName already exists`  | Same `userName` present from a legacy CSV import. Merge or rename.                                                           |
| 5xx responses                  | Check FATHOM status page; if persistent, open a support ticket with the `X-Request-Id` header from the failed SCIM response. |

---

## Security notes

- SCIM tokens are tenant-scoped; one tenant cannot read another's
  directory even with a valid token.
- The SCIM endpoint is rate-limited per token.
- All SCIM operations are written to the FATHOM tamper-evident audit
  log (`audit_log_secure`). Auditors can verify the chain from
  Settings → Audit → Verify integrity.
