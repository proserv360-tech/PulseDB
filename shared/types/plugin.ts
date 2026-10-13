/**
 * shared/types/plugin.ts
 * ──────────────────────
 * Canonical FATHOM plugin manifest, shared between frontend, backend, and SDK.
 *
 * A plugin is a declarative extension that contributes dashboards, metrics
 * panels, alert rule templates, or route extensions. It never ships
 * arbitrary server-side code — the runtime is the FATHOM host. This keeps
 * the supply chain small and auditable.
 */

export type PluginCapability =
    | 'dashboard'          // Contributes a dashboard definition
    | 'panel'              // Contributes a named chart/panel component
    | 'alert-template'     // Contributes one or more alert rule presets
    | 'metric-source';     // Contributes a new metric source (SDK-backed)

export interface PluginContribDashboard {
    type: 'dashboard';
    slug: string;
    name: string;
    definition: DashboardDefinition;
}

export interface PluginContribAlertTemplate {
    type: 'alert-template';
    slug: string;
    name: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    expression: string;
    cooldownMinutes?: number;
    runbookUrl?: string;
}

export interface PluginContribPanel {
    type: 'panel';
    slug: string;
    name: string;
    /** Public URL to an ES module that default-exports a React component. */
    entryUrl: string;
    /** Supported engines — e.g. ['postgres','mysql']. Used to gate visibility. */
    supportedEngines: Array<'postgres' | 'mysql' | 'mongodb'>;
}

export type PluginContribution =
    | PluginContribDashboard
    | PluginContribAlertTemplate
    | PluginContribPanel;

export interface PluginManifest {
    /** Stable slug, kebab-case. */
    slug: string;
    /** semver string. */
    version: string;
    name: string;
    description?: string;
    author?: string;
    license?: string;
    homepage?: string;
    /** Minimum FATHOM API version this plugin targets (e.g., "1"). */
    minFathomApi: string;
    capabilities: PluginCapability[];
    contributions: PluginContribution[];
    /** Workspace-scoped settings the installer must supply. */
    settingsSchema?: Record<string, PluginSettingDef>;
}

export interface PluginSettingDef {
    type: 'string' | 'number' | 'boolean' | 'secret' | 'enum';
    label: string;
    required?: boolean;
    default?: unknown;
    enumValues?: string[];
    description?: string;
}

export interface DashboardDefinition {
    version: 1;
    title: string;
    layout: DashboardPanelLayout[];
}

export interface DashboardPanelLayout {
    id: string;
    /** Grid position. */
    x: number; y: number; w: number; h: number;
    /** Either a built-in panel type or a plugin-contributed panel slug. */
    panel: string;
    /** Free-form panel options. */
    options?: Record<string, unknown>;
}
