// Alert WebSocket subscription.
// Extracted from App.tsx.
import { useEffect, useRef, useState } from 'react';
import { connectWS } from '../utils/api';

/* ─────────────────────────────────────────────────────────────────
   WEBSOCKET HOOK
   ───────────────────────────────────────────────────────────────── */
export const useWebSocket = (onMessage) => {
    const [connected, setConnected] = useState(false);
    const [reconnecting] = useState(false); // polling never shows "reconnecting"
    const stopRef = useRef(null);

    useEffect(() => {
        // connectWS now uses HTTP polling — no WebSocket, works on Vercel
        stopRef.current = connectWS((msg) => {
            setConnected(true);
            onMessage(msg);
        });
        return () => {
            if (stopRef.current) stopRef.current();
        };
    }, [onMessage]);

    return { connected, reconnecting };
};
