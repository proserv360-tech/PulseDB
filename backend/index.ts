// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: "PulseDB Backend - Use /api endpoint",
    endpoints: {
      api: "/api - Main API endpoint"
    }
  });
}
