/**
 * CloudInsightsTab.tsx — dashboard tab wrapper for CloudInsightsPanel.
 * Standalone (workspace-scoped) — no per-connection requirement.
 */
import CloudInsightsPanel from './CloudInsightsPanel';

export default function CloudInsightsTab() {
    return (
        <div className="tab-pad">
            <CloudInsightsPanel />
        </div>
    );
}
