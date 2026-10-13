/**
 * AuditAndSecurity.jsx — FULL REPLACEMENT
 * Path: src/usermanagement/PermissionMatrix/AuditAndSecurity.jsx
 * 100% self-contained — zero imports from ui.jsx or shared components
 */

import React, { useState, memo } from 'react';
import { THEME, useAdaptiveTheme } from '../../utils/theme';

/* ─── Theme ─────────────────────────────────────────────────────── */
const T = {
    get surface()    { return THEME.surface; },
    get surfaceHigh(){ return THEME.surfaceRaised; },
    get surfaceMid() { return THEME.surfaceHover; },
    get border()     { return THEME.grid; },
    get primary()    { return THEME.primary; },
    get primaryDim() { return THEME.primaryFaint; },
    get success()    { return THEME.success; },
    get warning()    { return THEME.warning; },
    get warningDim() { return `${THEME.warning}26`; },
    get danger()     { return THEME.danger; },
    get text()       { return THEME.textMain; },
    get textDim()    { return THEME.textMuted; },
    get textMuted()  { return THEME.textDim; },
};

/* ─── CSS updated on every render ───────────────────────────────── */
const STYLE_ID = 'as2-styles';
function ensureStyles() {
    if (typeof document === 'undefined') return;
    var el = document.getElementById(STYLE_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = [
        '.as2 { font-family: ' + THEME.fontBody + '; color:' + T.textMain + '; }',
        '.as2 *, .as2 *::before, .as2 *::after { box-sizing: border-box; }',

        '.as2-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius: 20px; border:none; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .15s; white-space:nowrap; }',
        '.as2-btn-ghost { background:transparent; color:' + T.textDim + '; border:1px solid ' + T.glassBorder + '; }',
        '.as2-btn-ghost:hover { background:' + T.surfaceRaised + '; color:' + T.textMain + '; }',
        '.as2-btn-danger { background:' + T.danger + '; color:#fff; }',
        '.as2-btn-danger:hover { filter:brightness(1.1); }',
        '.as2-btn-sm { padding:5px 10px; font-size:11px; }',

        '.as2-pill { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:20px; border:1px solid ' + T.glassBorder + '; background:transparent; color:' + T.textDim + '; font-size:12px; font-weight:500; cursor:pointer; font-family:inherit; transition:all .15s; }',
        '.as2-pill:hover { border-color:#1a3878; color:' + T.textMain + '; }',
        '.as2-pill.on { font-weight:700; }',

        '.as2-card { background:' + T.surface + '; border:1px solid ' + T.glassBorder + '; border-radius: 22px; }',

        '@keyframes as2-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }',
        '.as2-in { animation: as2-in .2s ease-out both; }',

        '@keyframes as2-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }',
        '.as2-pulse { animation: as2-pulse 2s infinite; }',
    ].join('\n');
}

/* ─── SVG icons ──────────────────────────────────────────────────── */
function Svg(props) {
    return React.createElement('svg', {
        width: props.size || 14,
        height: props.size || 14,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: props.color || 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        style: { flexShrink: 0, display: 'inline-flex' },
    }, props.children);
}

var ICONS = {
    alert: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('path', { d:'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
            React.createElement('line', { x1:'12', y1:'9', x2:'12', y2:'13' }),
            React.createElement('line', { x1:'12', y1:'17', x2:'12.01', y2:'17' })
        );
    },
    check: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('polyline', { points:'20 6 9 17 4 12' })
        );
    },
    activity: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('polyline', { points:'22 12 18 12 15 21 9 3 6 12 2 12' })
        );
    },
    users: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('path', { d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
            React.createElement('circle', { cx:'9', cy:'7', r:'4' }),
            React.createElement('path', { d:'M23 21v-2a4 4 0 0 0-3-3.87' }),
            React.createElement('path', { d:'M16 3.13a4 4 0 0 1 0 7.75' })
        );
    },
    download: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('path', { d:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
            React.createElement('polyline', { points:'7 10 12 15 17 10' }),
            React.createElement('line', { x1:'12', y1:'15', x2:'12', y2:'3' })
        );
    },
    key: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('path', { d:'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4' })
        );
    },
    trash: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('polyline', { points:'3 6 5 6 21 6' }),
            React.createElement('path', { d:'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' })
        );
    },
    plus: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('line', { x1:'12', y1:'5', x2:'12', y2:'19' }),
            React.createElement('line', { x1:'5', y1:'12', x2:'19', y2:'12' })
        );
    },
    monitor: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('rect', { x:'2', y:'3', width:'20', height:'14', rx:'2', ry:'2' }),
            React.createElement('line', { x1:'8', y1:'21', x2:'16', y2:'21' }),
            React.createElement('line', { x1:'12', y1:'17', x2:'12', y2:'21' })
        );
    },
    globe: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('circle', { cx:'12', cy:'12', r:'10' }),
            React.createElement('line', { x1:'2', y1:'12', x2:'22', y2:'12' }),
            React.createElement('path', { d:'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' })
        );
    },
    logOut: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('path', { d:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }),
            React.createElement('polyline', { points:'16 17 21 12 16 7' }),
            React.createElement('line', { x1:'21', y1:'12', x2:'9', y2:'12' })
        );
    },
    shield: function(sz, c) {
        return React.createElement(Svg, { size:sz, color:c },
            React.createElement('path', { d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' })
        );
    },
};

function Ico(props) {
    var fn = ICONS[props.name];
    if (!fn) return null;
    return React.createElement('span', {
        style: { display:'inline-flex', alignItems:'center', flexShrink:0 }
    }, fn(props.size || 14, props.color || 'currentColor'));
}

/* ─── Level config ───────────────────────────────────────────────── */
var LEVEL_COLOR = {
    info:     THEME.primary,
    warn:     THEME.warning,
    critical: THEME.danger,
    success:  THEME.success,
};

var RISK_COLOR = {
    low:      THEME.success,
    medium:   THEME.warning,
    high:     THEME.danger,
    critical: THEME.danger,
};

/* ─── Data (loaded from API when available) ──────────────────────── */
var AUDIT_EVENTS = [];

var INITIAL_SESSIONS = [];

var INITIAL_API_KEYS = [];

/* ─── Audit Log ──────────────────────────────────────────────────── */
export var AuditLog = function AuditLog() {
    useAdaptiveTheme();
    ensureStyles();
    var _f = useState('all');
    var filter    = _f[0];
    var setFilter = _f[1];

    var filtered = AUDIT_EVENTS.filter(function(e) {
        return filter === 'all' || e.level === filter;
    });

    return React.createElement('div', { className:'as2' },

        /* Filter bar */
        React.createElement('div', {
                style:{ display:'flex', gap: 20, marginBottom:16, alignItems:'center', flexWrap:'wrap' }
            },
            ['all','info','warn','critical','success'].map(function(l) {
                var lc = l !== 'all' ? LEVEL_COLOR[l] : undefined;
                var isOn = filter === l;
                return React.createElement('button', {
                    key: l,
                    className: 'as2-pill' + (isOn ? ' on' : ''),
                    onClick: function() { setFilter(l); },
                    style: isOn && lc ? { borderColor:lc, color:lc, background:lc+'15' } : {},
                }, l === 'all' ? 'All' : l.charAt(0).toUpperCase() + l.slice(1));
            }),
            React.createElement('button', {
                    className:'as2-btn as2-btn-ghost as2-btn-sm',
                    style:{ marginLeft:'auto' }
                },
                React.createElement(Ico, { name:'download', size:12 }),
                ' Export'
            )
        ),

        /* Event list */
        React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap: 20 } },
            filtered.length === 0
                ? React.createElement('div', { style:{ textAlign:'center', padding:'40px', color:T.textMuted, fontSize:13 } }, 'No events found')
                : filtered.map(function(entry, i) {
                    var lc = LEVEL_COLOR[entry.level] || T.textDim;
                    var iconName = (entry.level === 'critical' || entry.level === 'warn') ? 'alert'
                        : entry.level === 'success' ? 'check' : 'activity';
                    return React.createElement('div', {
                            key: entry.id,
                            className: 'as2-card as2-in',
                            style: { padding:'14px 16px', animationDelay: (i*40)+'ms' }
                        },
                        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap: 20 } },
                            /* level icon */
                            React.createElement('div', {
                                style:{ width:38, height:38, borderRadius: 16, flexShrink:0,
                                    background:lc+'15', border:'1px solid '+lc+'30',
                                    display:'flex', alignItems:'center', justifyContent:'center' }
                            }, React.createElement(Ico, { name:iconName, size:16, color:lc })),

                            /* grid */
                            React.createElement('div', {
                                    style:{ flex:1, display:'grid',
                                        gridTemplateColumns:'1.4fr 1fr 2fr 90px',
                                        gap: 18, alignItems:'center' }
                                },
                                /* action + time */
                                React.createElement('div', null,
                                    React.createElement('div', {
                                        style:{ fontSize:12, fontWeight:700, color:T.textMain,
                                            fontFamily: THEME.fontMono }
                                    }, entry.action),
                                    React.createElement('div', {
                                        style:{ fontSize:11, color:T.textDim, marginTop:2 }
                                    }, new Date(entry.ts).toLocaleString())
                                ),
                                /* user */
                                React.createElement('div', {
                                        style:{ fontSize:12, color:T.textDim,
                                            display:'flex', alignItems:'center', gap:5 }
                                    },
                                    React.createElement(Ico, { name:'users', size:11, color:T.textMuted }),
                                    entry.user
                                ),
                                /* detail */
                                React.createElement('div', {
                                    style:{ fontSize:11, color:T.textDim,
                                        fontFamily: THEME.fontMono,
                                        background:T.surfaceRaised, padding:'4px 8px',
                                        borderRadius: 16, overflow:'hidden',
                                        textOverflow:'ellipsis', whiteSpace:'nowrap' }
                                }, entry.detail),
                                /* badge */
                                React.createElement('div', { style:{ textAlign:'right' } },
                                    React.createElement('span', {
                                        style:{ display:'inline-flex', alignItems:'center', gap:5,
                                            padding:'3px 9px', borderRadius: 18, fontSize:10,
                                            fontWeight:700, background:lc+'18', color:lc,
                                            border:'1px solid '+lc+'30' }
                                    }, entry.level.toUpperCase())
                                )
                            )
                        )
                    );
                })
        )
    );
};

/* ─── Security Panel ─────────────────────────────────────────────── */
export var SecurityPanel = function SecurityPanel(props) {
    useAdaptiveTheme();
    ensureStyles();
    var users = props.users || [];

    var _s = useState(INITIAL_SESSIONS);
    var sessions    = _s[0];
    var setSessions = _s[1];

    var _k = useState(INITIAL_API_KEYS);
    var apiKeys    = _k[0];
    var setApiKeys = _k[1];

    var highRisk = users.filter(function(u) { return (u.riskScore || 0) > 70; });

    var revokeSession    = function(id) { setSessions(function(p) { return p.filter(function(s) { return s.id !== id; }); }); };
    var revokeAll        = function()   { setSessions([]); };
    var revokeApiKey     = function(id) { setApiKeys(function(p)   { return p.filter(function(k) { return k.id !== id; }); }); };

    return React.createElement('div', { className:'as2', style:{ display:'flex', flexDirection:'column', gap:24 } },

        /* High-risk alert */
        highRisk.length > 0 && React.createElement('div', {
                style:{ padding:16, borderRadius:16,
                    background:T.danger+'0d', border:'1px solid '+T.danger+'30' }
            },
            React.createElement('div', {
                    style:{ display:'flex', alignItems:'center', gap: 18, marginBottom:12 }
                },
                React.createElement(Ico, { name:'alert', size:18, color:T.danger }),
                React.createElement('div', {
                    style:{ fontSize:14, fontWeight:700, color:T.danger }
                }, highRisk.length + ' High-Risk User' + (highRisk.length !== 1 ? 's' : '') + ' Detected')
            ),
            React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', gap: 20 } },
                highRisk.map(function(u) {
                    return React.createElement('div', {
                            key: u.id,
                            style:{ display:'flex', alignItems:'center', gap: 20, padding:'6px 12px',
                                borderRadius: 20, background:T.danger+'15', border:'1px solid '+T.danger+'30' }
                        },
                        React.createElement('span', {
                            style:{ fontSize:13, fontWeight:600, color:T.textMain }
                        }, u.name),
                        React.createElement('span', {
                            style:{ fontSize:11, fontWeight:700, color:T.danger,
                                background:T.danger+'20', padding:'2px 6px', borderRadius: 16 }
                        }, 'Risk: ' + u.riskScore)
                    );
                })
            )
        ),

        /* Active Sessions */
        React.createElement('section', null,
            React.createElement('div', {
                    style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }
                },
                React.createElement('div', {
                        style:{ display:'flex', alignItems:'center', gap: 20,
                            fontSize:14, fontWeight:700, color:T.textMain }
                    },
                    React.createElement(Ico, { name:'globe', size:15, color:T.primary }),
                    'Active Sessions',
                    React.createElement('span', {
                        style:{ display:'inline-flex', padding:'3px 9px', borderRadius: 18,
                            fontSize:10, fontWeight:700,
                            background:T.primaryDim, color:T.primary }
                    }, sessions.filter(function(s) { return s.active; }).length + ' live')
                ),
                React.createElement('button', {
                        className:'as2-btn as2-btn-danger as2-btn-sm',
                        onClick: revokeAll
                    },
                    React.createElement(Ico, { name:'logOut', size:12, color:'#fff' }),
                    ' Revoke All'
                )
            ),

            React.createElement('div', {
                    style:{ border:'1px solid '+T.glassBorder, borderRadius:16, overflow:'hidden',
                        background:T.surface }
                },
                sessions.length === 0
                    ? React.createElement('div', {
                        style:{ padding:32, textAlign:'center', color:T.textDim, fontSize:13 }
                    }, 'No active sessions')
                    : sessions.map(function(s, i) {
                        var rc = RISK_COLOR[s.risk] || T.textDim;
                        return React.createElement('div', {
                                key: s.id,
                                style:{ padding:'14px 18px',
                                    borderBottom: i < sessions.length-1 ? '1px solid '+T.glassBorder : 'none',
                                    display:'flex', alignItems:'center', justifyContent:'space-between',
                                    background: s.risk === 'critical' ? T.danger+'08' : T.surface }
                            },
                            React.createElement('div', {
                                    style:{ display:'flex', alignItems:'center', gap: 20 }
                                },
                                /* device icon */
                                React.createElement('div', {
                                    style:{ width:40, height:40, borderRadius: 16,
                                        background:rc+'15', border:'1px solid '+rc+'30',
                                        display:'flex', alignItems:'center', justifyContent:'center' }
                                }, React.createElement(Ico, { name:'monitor', size:18, color:rc })),

                                React.createElement('div', null,
                                    React.createElement('div', {
                                            style:{ display:'flex', alignItems:'center', gap: 20,
                                                fontSize:13, fontWeight:600, color:T.textMain }
                                        },
                                        s.user,
                                        s.active && React.createElement('span', {
                                            className:'as2-pulse',
                                            style:{ width:7, height:7, borderRadius:'50%',
                                                background:T.success, display:'inline-block' }
                                        }),
                                        React.createElement('span', {
                                            style:{ display:'inline-flex', padding:'2px 7px',
                                                borderRadius: 16, fontSize:9, fontWeight:700,
                                                background:rc+'18', color:rc, border:'1px solid '+rc+'30' }
                                        }, s.risk.toUpperCase())
                                    ),
                                    React.createElement('div', {
                                        style:{ fontSize:11, color:T.textDim, marginTop:2,
                                            fontFamily: THEME.fontMono }
                                    }, s.ip + ' · ' + s.location),
                                    React.createElement('div', {
                                        style:{ fontSize:11, color:T.textDim }
                                    }, s.device)
                                )
                            ),
                            React.createElement('button', {
                                className:'as2-btn as2-btn-danger as2-btn-sm',
                                onClick: function() { revokeSession(s.id); }
                            }, 'Revoke')
                        );
                    })
            )
        ),

        /* API Keys */
        React.createElement('section', null,
            React.createElement('div', {
                    style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }
                },
                React.createElement('div', {
                        style:{ display:'flex', alignItems:'center', gap: 20,
                            fontSize:14, fontWeight:700, color:T.textMain }
                    },
                    React.createElement(Ico, { name:'key', size:15, color:T.warning }),
                    'API Keys'
                ),
                React.createElement('button', { className:'as2-btn as2-btn-ghost as2-btn-sm' },
                    React.createElement(Ico, { name:'plus', size:13 }),
                    ' New Key'
                )
            ),

            React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap: 22 } },
                apiKeys.map(function(key) {
                    return React.createElement('div', {
                            key: key.id,
                            className: 'as2-card',
                            style:{ display:'flex', alignItems:'center',
                                justifyContent:'space-between', padding:'14px 16px' }
                        },
                        React.createElement('div', {
                                style:{ display:'flex', alignItems:'center', gap: 20 }
                            },
                            React.createElement('div', {
                                style:{ width:36, height:36, borderRadius: 20,
                                    background:T.warningDim, border:'1px solid '+T.warning+'30',
                                    display:'flex', alignItems:'center', justifyContent:'center' }
                            }, React.createElement(Ico, { name:'key', size:16, color:T.warning })),

                            React.createElement('div', null,
                                React.createElement('div', {
                                    style:{ fontSize:13, fontWeight:600, color:T.textMain }
                                }, key.name),
                                React.createElement('div', {
                                        style:{ display:'flex', alignItems:'center', gap: 20, marginTop:3 }
                                    },
                                    React.createElement('code', {
                                        style:{ fontSize:11, color:T.textDim,
                                            fontFamily: THEME.fontMono,
                                            background:T.surfaceRaised, padding:'2px 6px', borderRadius: 16 }
                                    }, key.prefix + '............'),
                                    React.createElement('span', {
                                        style:{ fontSize:10, color:T.textDim }
                                    }, key.scope)
                                )
                            )
                        ),

                        React.createElement('div', {
                                style:{ display:'flex', alignItems:'center', gap: 18 }
                            },
                            React.createElement('div', { style:{ textAlign:'right' } },
                                React.createElement('div', {
                                    style:{ fontSize:12, fontWeight:700, color:T.textMain,
                                        fontFamily: THEME.fontMono }
                                }, key.calls.toLocaleString()),
                                React.createElement('div', {
                                    style:{ fontSize:10, color:T.textDim }
                                }, 'total calls')
                            ),
                            React.createElement('button', {
                                className:'as2-btn as2-btn-ghost as2-btn-sm',
                                'aria-label': 'Revoke ' + key.name,
                                onClick: function() { revokeApiKey(key.id); },
                                style:{ padding:'5px 8px' }
                            }, React.createElement(Ico, { name:'trash', size:13, color:T.danger }))
                        )
                    );
                })
            )
        ),

        /* Security overview footer */
        React.createElement('div', {
                style:{ padding:'16px 20px', borderRadius:16,
                    background:T.surfaceMid, border:'1px solid '+T.glassBorder,
                    display:'flex', alignItems:'center', gap: 18 }
            },
            React.createElement(Ico, { name:'shield', size:16, color:T.primary }),
            React.createElement('div', null,
                React.createElement('div', {
                    style:{ fontSize:13, fontWeight:600, color:T.textMain }
                }, 'Security Status'),
                React.createElement('div', {
                    style:{ fontSize:11, color:T.textDim, marginTop:2 }
                }, sessions.filter(function(s) { return s.risk === 'critical'; }).length + ' critical sessions · ' + apiKeys.length + ' active API keys · ' + highRisk.length + ' high-risk users')
            )
        )
    );
};