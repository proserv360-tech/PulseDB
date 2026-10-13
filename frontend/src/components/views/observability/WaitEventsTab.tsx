/**
 * WaitEventsTab.tsx — dashboard tab wrapper for WaitEventsPanel.
 * Pulls the active connection from context and renders the engine-agnostic
 * wait-events panel.
 */
import { useConnection } from '../../../context/ConnectionContext';
import WaitEventsPanel from './WaitEventsPanel';

export default function WaitEventsTab() {
    const { activeConnectionId } = useConnection();
    if (!activeConnectionId) {
        return <div className="tab-empty">Select a connection to view wait events.</div>;
    }
    return (
        <div className="tab-pad">
            <WaitEventsPanel connectionId={activeConnectionId} />
        </div>
    );
}
