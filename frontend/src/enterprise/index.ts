// ==========================================================================
//  FATHOM — Enterprise Module Exports
// ==========================================================================
//  Central exports for license and organization management

// Contexts
export { LicenseProvider, useLicense } from './context/LicenseContext';
export { OrgProvider, useOrg } from './context/OrgContext';

// Components
export { default as LicenseGate } from './components/LicenseGate';
export { default as UpgradeBanner } from './components/UpgradeBanner';
export { default as OrgSwitcher } from './components/OrgSwitcher';
export { default as LicenseStatus } from './components/LicenseStatus';

// Views
export { default as LicenseManagement } from './views/LicenseManagement';
export { default as OrgManagement } from './views/OrgManagement';
