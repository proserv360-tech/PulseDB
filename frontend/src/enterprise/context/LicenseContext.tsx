// ==========================================================================
//  FATHOM — License Context (neutralized)
// ==========================================================================
//  Single-edition product. Kept only so App.tsx's existing
//  <LicenseProvider> wrapper (and any stale useLicense() calls) still work.
//  Every feature is granted; no backend call; no periodic refresh.
// ==========================================================================

import React, { createContext, useContext, useMemo } from 'react';

const LicenseContext = createContext<any>(null);

const FULL_ACCESS_VALUE = {
    license: { tier: 'full', features: [] },
    tier: 'full',
    features: [] as string[],
    isEnterprise: true,
    isPro: true,
    isCommunity: false,
    isFeatureAvailable: (_feature: string) => true,
    refreshLicense: async () => {},
    loading: false,
    error: null,
};

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const value = useMemo(() => FULL_ACCESS_VALUE, []);
    return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
};

export const useLicense = () => {
    const ctx = useContext(LicenseContext);
    // If somehow called outside the provider, still grant full access rather
    // than throwing — this product has no license gating any more.
    return ctx || FULL_ACCESS_VALUE;
};

export default LicenseContext;
