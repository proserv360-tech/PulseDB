// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * enterprise/organization/orgService.js
 * ────────────────────────────────────
 * Multi-tenancy organization service.
 * Manages organizations, members, and roles.
 */

const S = 'pgmonitoringtool';

/* ─── ROW NORMALISERS ──────────────────────────────────────────────────────── */

function toClientOrg(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    description: row.description ?? null,
    metadata: row.metadata ?? {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toClientMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.member_role,
    joinedAt: row.joined_at,
  };
}

/* ─── CREATE ───────────────────────────────────────────────────────────────── */

/**
 * Create a new organization.
 * @param {object} pool - PostgreSQL connection pool
 * @param {object} data - { name, slug, ownerId, description }
 * @returns {object|null} Created organization or null
 */
export async function createOrganization(pool, data) {
  const { name, slug, ownerId, description = null } = data;

  if (!name || !slug || !ownerId) {
    throw new Error('Missing required fields: name, slug, ownerId');
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO ${S}.organizations (name, slug, owner_id, description, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [name, slug, ownerId, description]
    );
    return toClientOrg(rows[0]);
  } catch (err) {
    console.error('Error creating organization:', err);
    if (err.code === '23505') { // unique violation
      throw new Error('Organization slug already exists');
    }
    throw err;
  }
}

/* ─── READ ─────────────────────────────────────────────────────────────────── */

/**
 * Get organization by ID.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @returns {object|null} Organization or null
 */
export async function getOrganization(pool, orgId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${S}.organizations WHERE id = $1`, [orgId]
    );
    return rows[0] ? toClientOrg(rows[0]) : null;
  } catch (err) {
    console.error('Error fetching organization:', err);
    return null;
  }
}

/**
 * Get organization by slug.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} slug - Organization slug
 * @returns {object|null} Organization or null
 */
export async function getOrganizationBySlug(pool, slug) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${S}.organizations WHERE slug = $1`, [slug]
    );
    return rows[0] ? toClientOrg(rows[0]) : null;
  } catch (err) {
    console.error('Error fetching organization by slug:', err);
    return null;
  }
}

/**
 * List all organizations (admin only).
 * @param {object} pool - PostgreSQL connection pool
 * @returns {object[]} Array of organizations
 */
export async function listOrganizations(pool) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${S}.organizations ORDER BY created_at DESC`
    );
    return rows.map(toClientOrg);
  } catch (err) {
    console.error('Error listing organizations:', err);
    return [];
  }
}

/**
 * Get organizations a user belongs to.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} userId - User ID
 * @returns {object[]} Array of organizations
 */
export async function getUserOrganizations(pool, userId) {
  try {
    const { rows } = await pool.query(
      `SELECT o.* FROM ${S}.organizations o
       JOIN ${S}.org_members m ON m.org_id = o.id
       WHERE m.user_id = $1 AND o.status = 'active'
       ORDER BY o.created_at DESC`,
      [userId]
    );
    return rows.map(toClientOrg);
  } catch (err) {
    console.error('Error fetching user organizations:', err);
    return [];
  }
}

/* ─── UPDATE ───────────────────────────────────────────────────────────────── */

/**
 * Update organization settings.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {object} data - { name, description, metadata, status }
 * @returns {object|null} Updated organization or null
 */
export async function updateOrganization(pool, orgId, data) {
  try {
    const existing = await getOrganization(pool, orgId);
    if (!existing) return null;

    const { rows } = await pool.query(
      `UPDATE ${S}.organizations SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        metadata = COALESCE($3, metadata),
        status = COALESCE($4, status),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [data.name ?? null, data.description ?? null, data.metadata ?? null, data.status ?? null, orgId]
    );
    return rows[0] ? toClientOrg(rows[0]) : null;
  } catch (err) {
    console.error('Error updating organization:', err);
    return null;
  }
}

/* ─── MEMBERS ──────────────────────────────────────────────────────────────── */

/**
 * Add a user to an organization with a role.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID
 * @param {string} role - Member role (owner, admin, member)
 * @returns {object|null} Member record or null
 */
export async function addUserToOrg(pool, orgId, userId, role = 'member') {
  try {
    const { rows } = await pool.query(
      `INSERT INTO ${S}.org_members (org_id, user_id, member_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, user_id) DO UPDATE SET member_role = $3
       RETURNING *`,
      [orgId, userId, role]
    );
    return rows[0] ? toClientMember(rows[0]) : null;
  } catch (err) {
    console.error('Error adding user to organization:', err);
    throw err;
  }
}

/**
 * Remove a user from an organization.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID
 * @returns {boolean} True if removed
 */
export async function removeUserFromOrg(pool, orgId, userId) {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ${S}.org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    );
    return rowCount > 0;
  } catch (err) {
    console.error('Error removing user from organization:', err);
    return false;
  }
}

/**
 * Update a member's role in an organization.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID
 * @param {string} role - New role (owner, admin, member)
 * @returns {object|null} Updated member or null
 */
export async function updateMemberRole(pool, orgId, userId, role) {
  try {
    const { rows } = await pool.query(
      `UPDATE ${S}.org_members SET member_role = $1 WHERE org_id = $2 AND user_id = $3
       RETURNING *`,
      [role, orgId, userId]
    );
    return rows[0] ? toClientMember(rows[0]) : null;
  } catch (err) {
    console.error('Error updating member role:', err);
    return null;
  }
}

/**
 * Get organization members.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @returns {object[]} Array of members with user details
 */
export async function getOrgMembers(pool, orgId) {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, u.username, u.name, u.email
       FROM ${S}.org_members m
       JOIN ${S}.users u ON u.id = m.user_id
       WHERE m.org_id = $1
       ORDER BY m.joined_at DESC`,
      [orgId]
    );
    return rows.map(toClientMember);
  } catch (err) {
    console.error('Error fetching organization members:', err);
    return [];
  }
}

/**
 * Get a specific member's record.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID
 * @returns {object|null} Member or null
 */
export async function getOrgMember(pool, orgId, userId) {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, u.username, u.name, u.email
       FROM ${S}.org_members m
       JOIN ${S}.users u ON u.id = m.user_id
       WHERE m.org_id = $1 AND m.user_id = $2`,
      [orgId, userId]
    );
    return rows[0] ? toClientMember(rows[0]) : null;
  } catch (err) {
    console.error('Error fetching organization member:', err);
    return null;
  }
}

/**
 * Get member count for an organization.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @returns {number} Member count
 */
export async function getOrgMemberCount(pool, orgId) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int as count FROM ${S}.org_members WHERE org_id = $1`,
      [orgId]
    );
    return rows[0]?.count ?? 0;
  } catch (err) {
    console.error('Error counting organization members:', err);
    return 0;
  }
}

/* ─── VALIDATION ───────────────────────────────────────────────────────────── */

/**
 * Check if a user is a member of an organization.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID
 * @returns {boolean} True if member
 */
export async function isOrgMember(pool, orgId, userId) {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM ${S}.org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('Error checking org membership:', err);
    return false;
  }
}

/**
 * Check if a user is an owner or admin of an organization.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID
 * @returns {boolean} True if owner or admin
 */
export async function isOrgAdmin(pool, orgId, userId) {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM ${S}.org_members
       WHERE org_id = $1 AND user_id = $2 AND member_role IN ('owner', 'admin')`,
      [orgId, userId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('Error checking org admin status:', err);
    return false;
  }
}

/**
 * Check if a slug is available.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} slug - Slug to check
 * @returns {boolean} True if available
 */
export async function isSlugAvailable(pool, slug) {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM ${S}.organizations WHERE slug = $1`, [slug]
    );
    return rows.length === 0;
  } catch (err) {
    console.error('Error checking slug availability:', err);
    return false;
  }
}
