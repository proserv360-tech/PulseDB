// ==========================================================================
//  FATHOM — Notifier Settings View
// ==========================================================================
//  Admin surface for the multi-channel notifier stack (P1 / G1).
//  Backed by /api/enterprise/notifiers.
// ==========================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, PlusCircle, Send, Trash2 } from 'lucide-react';
import { fetchData, postData, deleteData } from '../../utils/api';
import { THEME } from '../../utils/theme';
import {
    Page, PageHeader, Card, Muted, Alert, Button, Input, Select, Textarea, Table,
} from './_viewKit';

type NotifierKind = 'pagerduty' | 'opsgenie' | 'teams' | 'webhook';

interface NotifierRow {
    id: string;
    kind: NotifierKind;
    label: string;
    enabled: boolean;
    lastUsedAt?: string | null;
    lastStatus?: 'ok' | 'failed' | 'pending' | null;
    createdAt?: string | null;
}

const KIND_LABELS: Record<NotifierKind, string> = {
    pagerduty: 'PagerDuty',
    opsgenie: 'Opsgenie',
    teams: 'Microsoft Teams',
    webhook: 'Generic Webhook',
};

const statusColor = (s?: string | null) => {
    if (s === 'ok') return THEME.success;
    if (s === 'failed') return THEME.danger;
    if (s === 'pending') return THEME.warning;
    return THEME.textMuted;
};

const NotifierSettingsInner: React.FC = () => {
    const [rows, setRows] = useState<NotifierRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<{ kind: NotifierKind; label: string; config: string }>({
        kind: 'webhook',
        label: '',
        config: '{}',
    });

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchData('/api/enterprise/notifiers');
            setRows(data?.notifiers ?? []);
        } catch (err: any) {
            setError(err?.message || 'Failed to load notifiers');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError(null);
        try {
            let configObj: Record<string, unknown>;
            try {
                configObj = JSON.parse(form.config);
            } catch {
                setError('Config must be valid JSON');
                setCreating(false);
                return;
            }
            await postData('/api/enterprise/notifiers', {
                kind: form.kind,
                label: form.label,
                config: configObj,
            });
            setForm({ kind: 'webhook', label: '', config: '{}' });
            await refresh();
        } catch (err: any) {
            setError(err?.message || 'Failed to create notifier');
        } finally {
            setCreating(false);
        }
    };

    const handleTest = async (id: string) => {
        try {
            await postData(`/api/enterprise/notifiers/${id}/test`, {});
            await refresh();
        } catch (err: any) {
            setError(err?.message || 'Test failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Remove this notifier?')) return;
        try {
            await deleteData(`/api/enterprise/notifiers/${id}`);
            await refresh();
        } catch (err: any) {
            setError(err?.message || 'Delete failed');
        }
    };

    return (
        <Page>
            <PageHeader
                icon={<Bell size={18} />}
                title="Notifier settings"
                subtitle="PagerDuty, Opsgenie, Teams, and webhook destinations"
                accent={THEME.primary}
                onRefresh={refresh}
                refreshing={loading}
            />

            {error && <Alert>{error}</Alert>}

            <Card title="Configured">
                {loading && rows.length === 0 ? (
                    <Muted>Loading…</Muted>
                ) : rows.length === 0 ? (
                    <Muted>No notifiers configured yet. Add one below.</Muted>
                ) : (
                    <Table
                        columns={[
                            { key: 'label', label: 'Label', mono: true },
                            { key: 'kind', label: 'Kind' },
                            { key: 'status', label: 'Status' },
                            { key: 'lastUsed', label: 'Last used' },
                            { key: 'actions', label: '', align: 'right' },
                        ]}
                        rows={rows.map((r) => ({
                            label: r.label,
                            kind: KIND_LABELS[r.kind],
                            status: (
                                <span
                                    style={{
                                        color: statusColor(r.lastStatus ?? (r.enabled ? 'ok' : null)),
                                        fontWeight: 600,
                                        fontSize: 12,
                                    }}
                                >
                                    {r.lastStatus ?? (r.enabled ? 'enabled' : 'disabled')}
                                </span>
                            ),
                            lastUsed: r.lastUsedAt ?? '—',
                            actions: (
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        gap: 6,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <Button
                                        size="sm"
                                        onClick={() => handleTest(r.id)}
                                        ariaLabel={`Send test to ${r.label}`}
                                    >
                                        <Send size={11} /> Test
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => handleDelete(r.id)}
                                        ariaLabel={`Remove ${r.label}`}
                                    >
                                        <Trash2 size={11} /> Remove
                                    </Button>
                                </div>
                            ),
                        }))}
                        rowKey={(_r: any, idx: number) => rows[idx]?.id ?? String(idx)}
                    />
                )}
            </Card>

            <Card
                title="Add a notifier"
                right={<PlusCircle size={14} color={THEME.primary} />}
            >
                <form
                    onSubmit={handleCreate}
                    style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}
                >
                    <div style={{ display: 'flex', gap: 8 }}>
                        <label htmlFor="notifier-kind" style={{ position: 'absolute', left: -9999 }}>
                            Kind
                        </label>
                        <Select
                            id="notifier-kind"
                            value={form.kind}
                            onChange={(e) =>
                                setForm({ ...form, kind: e.target.value as NotifierKind })
                            }
                            style={{ width: 'auto', minWidth: 160 }}
                        >
                            <option value="webhook">Webhook</option>
                            <option value="teams">Teams</option>
                            <option value="pagerduty">PagerDuty</option>
                            <option value="opsgenie">Opsgenie</option>
                        </Select>
                        <label htmlFor="notifier-label" style={{ position: 'absolute', left: -9999 }}>
                            Label
                        </label>
                        <Input
                            id="notifier-label"
                            value={form.label}
                            onChange={(e) => setForm({ ...form, label: e.target.value })}
                            placeholder="Label (e.g. prod-pager)"
                            required
                            style={{ flex: 1 }}
                        />
                    </div>
                    <label htmlFor="notifier-config" style={{ position: 'absolute', left: -9999 }}>
                        Config JSON
                    </label>
                    <Textarea
                        id="notifier-config"
                        value={form.config}
                        onChange={(e) => setForm({ ...form, config: e.target.value })}
                        placeholder='Config JSON (e.g. {"url":"https://...","secret":"..."})'
                        rows={5}
                        mono
                    />
                    <div>
                        <Button type="submit" variant="primary" disabled={creating}>
                            <PlusCircle size={13} />
                            {creating ? 'Creating…' : 'Create'}
                        </Button>
                    </div>
                </form>
            </Card>
        </Page>
    );
};

const NotifierSettings: React.FC = () => <NotifierSettingsInner />;

export default NotifierSettings;
