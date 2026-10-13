/* ═══════════════════════════════════════════════════════════════════════════
   useMetricsTab.tsx

   Convenience helper that turns a MetricCatalog into a fully-wired demo tab.

   Each Full tab (SQL Server, Oracle, Redis, ...) calls this hook with its
   catalog and gets back the `sections` + `renderContent` props ready to
   pass straight into <DemoLayout/>.

   The result keeps the catalog's section order intact and adds a special
   "all" pseudo-section at the top that surfaces the full search experience
   (so users can hunt across every metric, not just one section's slice).
   ═══════════════════════════════════════════════════════════════════════════ */

import React from 'react';
import { Activity, Search } from 'lucide-react';
import { MetricCatalog } from '../../../utils/metricsCatalog';
import MetricsExplorer from './MetricsExplorer';

export interface MetricsTabBundle {
    sections: any[];
    renderContent: (sectionKey: string, itemKey: string) => React.ReactNode;
}

export function buildMetricsTab(catalog: MetricCatalog): MetricsTabBundle {
    /* Build sidebar sections from catalog.sections. We also surface an
       "All metrics" item at the top under the same logical group so the
       user can land on a full searchable view first. */
    const items = [
        { key: '__all', label: 'All metrics', icon: Search },
        ...catalog.sections.map((s) => ({ key: s.key, label: s.label, icon: undefined })),
    ];

    const sections = [
        {
            key: 'metrics',
            label: 'Metrics',
            icon: Activity,
            accent: catalog.accentColor,
            items,
        },
    ];

    const renderContent = (_sectionKey: string, itemKey: string) => {
        if (itemKey === '__all' || !itemKey) {
            return <MetricsExplorer catalog={catalog} />;
        }
        return <MetricsExplorer catalog={catalog} sectionKey={itemKey} />;
    };

    return { sections, renderContent };
}
