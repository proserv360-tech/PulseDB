# Microsoft Entra ID SCIM Provisioning for FATHOM

**Audience:** Entra admin at a FATHOM Enterprise tenant.
**Prerequisite:** Enterprise plan; a FATHOM admin account; tenant ID for
your Entra directory; permission to add an enterprise application.

---

## What SCIM gives you

Automated, push-based user and group lifecycle from Entra ID:

- Assignment of a user to the FATHOM enterprise app provisions them.
- Removal or disablement in Entra deactivates them in FATHOM
  (`active: false`).
- Group claims push role membership.

Authentication (sign-in) is handled via SAML SSO separately; SCIM is the
directory-sync channel only.

---

## Step 1 — Mint a SCIM bearer token in FATHOM

1. Sign in to FATHOM as an admin.
2. Settings → Integrations → SCIM provisioning → **Create token**.
3. Label it `entra-prod`.
4. Copy the token (shown once; starts with `fathom_scim_`) into your
   password manager. Losing it means rotating — see the Rotation
   section.

---

## Step 2 — Create the Entra enterprise app

1. Entra admin portal → Enterprise applications → **New application**.
2. Choose **Create your own application** → "Integrate any other
   application you don't find in the gallery (Non-gallery)". Name it
   `FATHOM`.
3. On the app's **Provisioning** page, click **Get started**.
4. Provisioning Mode: **Automatic**.
5. Admin Credentials:
    - **Tenant URL**: `https://<your-fathom-host>/scim/v2`
    - **Secret Token**: paste the `fathom_scim_...` value.
6. Click **Test Connection**. It should report "The supplied credentials
   are authorized to enable provisioning".

---

## Step 3 — Configure mappings

Open **Mappings** → **Provision Microsoft Entra ID Users**. These are
Entra's default mappings; adjust to match FATHOM's expectations:

| Entra attribute                                             | SCIM (FATHOM) attribute        | Notes                                                    |
| ----------------------------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| `userPrincipalName`                                         | `userName`                     | Required. Keep as UPN so it lines up with SAML NameID.   |
| `Switch(IsSoftDeleted, , "False", "True", "True", "False")` | `active`                       | Entra's default; keep as-is.                             |
| `displayName`                                               | `displayName`                  | Optional.                                                |
| `givenName`                                                 | `name.givenName`               |                                                          |
| `surname`                                                   | `name.familyName`              |                                                          |
| `mail`                                                      | `emails[type eq "work"].value` | Set `emails[type eq "work"].primary` = `true`.           |
| `objectId`                                                  | `externalId`                   | Stable across renames; FATHOM uses this for correlation. |

Turn off any mappings for attributes FATHOM doesn't accept (timezone,
address, etc.) to reduce noise in logs. Unsupported attributes result in
a 200 with the attribute silently dropped — not an error, just overhead.

For **Groups**, use the same attribute mapping screen:

| Entra attribute | SCIM attribute |
| --------------- | -------------- |
| `displayName`   | `displayName`  |
| `objectId`      | `externalId`   |
| `members`       | `members`      |

---

## Step 4 — Set scope and enable

1. **Settings** → Scope: choose "Sync only assigned users and groups"
   (recommended) or "Sync all users and groups" (broad — usually too
   broad for a monitoring tool).
2. **Provisioning Status**: **On**.
3. Save.
4. On the **Users and groups** tab, assign test users and any groups
   you want pushed.

Entra will start provisioning on a ~40-minute interval by default. You
can trigger an on-demand sync from the Provisioning page ("Provision
on demand") for faster iteration.

---

## Step 5 — Verify

1. After the first sync cycle (or after an on-demand run), open FATHOM
   → Settings → Users. Your assigned users should be present.
2. Remove an assignment in Entra for a test user. The next sync
   should mark them `active: false` in FATHOM within ~40 minutes.
3. Audit tab in FATHOM shows the SCIM events (`CREATE_USER`,
   `REPLACE_USER`, `DEACTIVATE_USER`).

---

## Rotation and revocation

- Rotate every 90 days. Procedure:
    1. Mint a new token in FATHOM.
    2. In Entra, update Admin Credentials → Secret Token.
    3. Test Connection.
    4. Revoke the old token in FATHOM.
- Emergency revocation: FATHOM → Settings → SCIM tokens → Revoke. The
  next Entra sync will 401; Entra's dashboard will show the
  provisioning error within one cycle.

---

## Troubleshooting

| Symptom                                                          | Likely cause / fix                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| "The supplied credentials are not authorized" on Test Connection | Token typo, token revoked, or feature gate blocking (tenant not Enterprise).                                         |
| Users provisioned but with wrong `userName`                      | Check that Entra's `userPrincipalName` is mapped — Entra sometimes defaults to `mailNickname`.                       |
| Provisioning shows "skipped — no matching SCIM attribute"        | Remove the offending mapping entry; FATHOM only supports the attributes in the table above.                          |
| Users not deactivating                                           | Confirm "Sync only assigned users and groups" is the scope. Un-assignment vs. disablement produce different signals. |
| Repeated 429 errors                                              | Entra is exceeding per-token rate limits. Slow the sync interval under Provisioning → Settings.                      |
| Group members missing                                            | Verify the group is assigned in "Users and groups" _and_ scope is not set to user-only.                              |

---

## Security notes

- The token is tenant-scoped. A stolen token cannot enumerate another
  FATHOM customer's directory.
- Every SCIM mutation is recorded in the tamper-evident audit log.
  You can export the audit range that overlaps your Entra sync window
  to reconcile against Entra's own logs.
- If you rotate Entra's tenant (e.g. migrate from test to prod), mint
  a fresh SCIM token in the new FATHOM tenant; do **not** re-use the
  test token.
