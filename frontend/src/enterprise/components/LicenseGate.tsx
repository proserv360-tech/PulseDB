// ==========================================================================
//  FATHOM — License Gate (neutralized)
// ==========================================================================
//  This product ships as a single edition — there is no community / pro /
//  enterprise tier split. LicenseGate used to render an UpgradeBanner when
//  the active license didn't include a feature; it now renders its children
//  unconditionally. Kept as a thin pass-through so existing call sites
//  (and tests that mock it) keep working without edits.
// ==========================================================================

import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LicenseGate = ({ feature, tier, children, fallback }: any) => {
    return <>{children}</>;
};

export default LicenseGate;
