/**
 * TableAndMatrix.jsx - FULL REPLACEMENT
 * Path: src/usermanagement/Toggle/TableAndMatrix.jsx
 * NOTE: ASCII-only file - no special unicode characters
 */

import React, { useState, useMemo, useCallback, memo } from 'react';
import { THEME, useAdaptiveTheme } from '../../../../utils/theme';

const T = {
    get surface()     { return THEME.surface; },
    get surfaceHigh() { return THEME.surfaceRaised; },
    get surfaceMid()  { return THEME.surfaceHover; },
    get border()      { return THEME.grid; },
    get primary()     { return THEME.primary; },
    get primaryGlow() { return THEME.primaryFaint; },
    get green()       { return THEME.success; },
    get yellow()      { return THEME.warning; },
    get red()         { return THEME.danger; },
    get text()        { return THEME.textMain; },
    get textDim()     { return THEME.textMuted; },
    get textMuted()   { return THEME.textDim; },
};

const ROLE_CFG = {
    superadmin: { label: 'Super Admin', color: THEME.warning, bg: '#fbbf2418', icon: 'SA' },
    admin:      { label: 'Admin',       color: THEME.primary, bg: '#3b82f61a', icon: 'AD' },
    editor:     { label: 'Editor',      color: THEME.primary, bg: '#3b82f614', icon: 'ED' },
    viewer:     { label: 'Viewer',      color: THEME.success, bg: '#34d39914', icon: 'VW' },
    guest:      { label: 'Guest',       color: THEME.textMuted, bg: '#9db4dc18', icon: 'GS' },
};

const STATUS_CFG = {
    active:    { label: 'Active',    color: THEME.success, bg: '#34d39916', dot: THEME.success },
    inactive:  { label: 'Inactive',  color: THEME.textMuted, bg: '#9db4dc16', dot: THEME.textMuted },
    suspended: { label: 'Suspended', color: THEME.danger, bg: '#fb718516', dot: THEME.danger },
};

const RISK_CFG = {
    low:      { label: 'Low',  color: THEME.success, pct: 25 },
    medium:   { label: 'Med',  color: THEME.warning, pct: 55 },
    high:     { label: 'High', color: THEME.danger, pct: 82 },
    critical: { label: 'Crit', color: THEME.danger, pct: 100 },
};

const getInitials = (n) => {
    if (!n) return '?';
    return n.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
};

const getAvatarColor = (n) => {
    var p = [THEME.primary,THEME.primary,THEME.success,THEME.warning,THEME.primary,THEME.purple,THEME.warning];
    var h = 0;
    var str = n || '';
    for (var i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return p[Math.abs(h) % p.length];
};

const formatDate = (raw) => {
    if (!raw) return '--';
    var d = new Date(raw);
    if (isNaN(d.getTime())) return '--';
    var diff = Date.now() - d.getTime();
    var m = Math.floor(diff / 60000);
    if (m < 60) return m + 'm ago';
    var h = Math.floor(diff / 3600000);
    if (h < 24) return h + 'h ago';
    var dy = Math.floor(diff / 86400000);
    if (dy < 7) return dy + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

const STYLE_ID = 'ut2-styles-v3';
function ensureStyles() {
    if (typeof document === 'undefined') return;
    var el = document.getElementById(STYLE_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = [
        '.ut2{font-family:' + THEME.fontBody + ';color:' + T.textMain + '}',
        '.ut2 *,.ut2 *::before,.ut2 *::after{box-sizing:border-box}',

        '.ut2-search{position:relative;display:inline-flex;align-items:center}',
        '.ut2-search input{width:270px;padding:8px 12px 8px 36px;background:' + T.surfaceRaised + ';border:1px solid ' + T.glassBorder + ';border-radius:9px;color:' + T.textMain + ';font-size:13px;font-family:inherit;outline:none;transition:border-color .18s,box-shadow .18s}',
        '.ut2-search input::placeholder{color:' + T.textMuted + '}',
        '.ut2-search input:focus{border-color:' + T.primary + ';box-shadow:0 0 0 3px ' + T.primaryGlow + '}',
        '.ut2-sico{position:absolute;left:10px;pointer-events:none}',

        '.ut2-pill{padding:5px 13px;border-radius:20px;border:1px solid ' + T.glassBorder + ';background:transparent;color:' + T.textDim + ';font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all .15s}',
        '.ut2-pill:hover{border-color:#1a3878;color:' + T.textMain + '}',
        '.ut2-pill.on{font-weight:700}',

        '.ut2-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}',
        '.ut2-btn-g{background:transparent;color:' + T.textDim + ';border:1px solid ' + T.glassBorder + '}',
        '.ut2-btn-g:hover{background:' + T.surfaceRaised + ';color:' + T.textMain + '}',
        '.ut2-btn-p{background:' + T.primary + ';color:#fff}',
        '.ut2-btn-p:hover{filter:brightness(1.12);transform:translateY(-3px)}',

        '.ut2-tbl{width:100%;border-collapse:collapse;table-layout:fixed}',
        '.ut2-tbl thead tr{background:' + T.surfaceMid + ';border-bottom:1px solid ' + T.glassBorder + '}',
        '.ut2-tbl th{padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:' + T.textMuted + ';letter-spacing:.07em;text-transform:uppercase;white-space:nowrap;user-select:none}',
        '.ut2-tbl th.s{cursor:pointer}',
        '.ut2-tbl th.s:hover{color:' + T.textDim + '}',
        '.ut2-tbl tbody tr{border-bottom:1px solid ' + T.glassBorder + '33;transition:background .1s;cursor:pointer}',
        '.ut2-tbl tbody tr:last-child{border-bottom:none}',
        '.ut2-tbl tbody tr:hover{background:' + T.surfaceRaised + '66}',
        '.ut2-tbl tbody tr.sel{background:' + T.primaryGlow + '}',
        '.ut2-tbl td{padding:13px 14px;vertical-align:middle}',

        '.ut2-cb{width:15px;height:15px;border-radius: 20px;border:1.5px solid ' + T.glassBorder + ';background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer;position:relative;transition:all .15s;display:block}',
        '.ut2-cb:checked{background:' + T.primary + ';border-color:' + T.primary + '}',
        '.ut2-cb:checked::after{content:"";position:absolute;left:2px;top:0px;width:8px;height:5px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg)}',

        '.ut2-av{width:34px;height:34px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;letter-spacing:.04em}',

        '.ut2-ib{width:28px;height:28px;border-radius: 22px;border:1px solid ' + T.glassBorder + ';background:transparent;color:' + T.textDim + ';cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}',
        '.ut2-ib:hover{border-color:' + T.primary + ';color:' + T.primary + ';background:' + T.primaryGlow + '}',
        '.ut2-ib.d:hover{border-color:' + T.red + ';color:' + T.red + ';background:' + T.red + '15}',

        '.ut2-rbar{height:3px;border-radius:2px;background:' + T.glassBorder + ';width:56px;margin-top:3px}',
        '.ut2-rfil{height:100%;border-radius:2px}',

        '.ut2-pg{width:28px;height:28px;border-radius: 22px;border:1px solid ' + T.glassBorder + ';background:transparent;color:' + T.textDim + ';font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;transition:all .15s}',
        '.ut2-pg:hover:not(:disabled){border-color:' + T.primary + ';color:' + T.primary + '}',
        '.ut2-pg.on{background:' + T.primary + ';border-color:' + T.primary + ';color:#fff}',
        '.ut2-pg:disabled{opacity:.3;cursor:not-allowed}',

        '@keyframes ut2-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
        '.ut2-in{animation:ut2-in .18s ease-out both}',
    ].join('\n');
}

/* SVG icons - no special chars */
var EditSVG = function() {
    return React.createElement('svg', { width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:'2', strokeLinecap:'round', strokeLinejoin:'round' },
        React.createElement('path', { d:'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
        React.createElement('path', { d:'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
    );
};

var TrashSVG = function() {
    return React.createElement('svg', { width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:'2', strokeLinecap:'round', strokeLinejoin:'round' },
        React.createElement('polyline', { points:'3 6 5 6 21 6' }),
        React.createElement('path', { d:'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' })
    );
};

var RoleBadge = memo(function(props) {
    var role = props.role || '';
    var key = role.toLowerCase().replace(/\s+/g, '');
    var c = ROLE_CFG[key] || ROLE_CFG.guest;
    return React.createElement('span', {
            style: {
                display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px',
                borderRadius:20, background:c.bg, color:c.color, fontSize:11, fontWeight:700,
                whiteSpace:'nowrap'
            }
        },
        React.createElement('span', { style:{ fontSize:9, fontWeight:900, opacity:0.7 } }, c.icon),
        c.label
    );
});

var StatusBadge = memo(function(props) {
    var status = props.status || '';
    var c = STATUS_CFG[status.toLowerCase()] || STATUS_CFG.inactive;
    return React.createElement('span', {
            style: {
                display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px',
                borderRadius:20, background:c.bg, color:c.color, fontSize:11, fontWeight:600,
                whiteSpace:'nowrap'
            }
        },
        React.createElement('span', {
            style:{ width:5, height:5, borderRadius:'50%', background:c.dot,
                boxShadow:'0 0 5px ' + c.dot, flexShrink:0 }
        }),
        c.label
    );
});

var RiskCell = memo(function(props) {
    useAdaptiveTheme();
    var risk = props.risk || '';
    if (!risk) return React.createElement('span', { style:{ color:T.textMuted, fontSize:12 } }, '--');
    var c = RISK_CFG[risk.toLowerCase()] || { label: risk, color: T.textDim, pct: 30 };
    return React.createElement('div', null,
        React.createElement('span', { style:{ fontSize:11, fontWeight:700, color:c.color } }, c.label),
        React.createElement('div', { className:'ut2-rbar' },
            React.createElement('div', { className:'ut2-rfil', style:{ width: c.pct + '%', background:c.color } })
        )
    );
});

var Pill = function(props) {
    var extraStyle = (props.active && props.color)
        ? { borderColor:props.color, color:props.color, background:props.bg || 'transparent' }
        : {};
    return React.createElement('button', {
        className: 'ut2-pill' + (props.active ? ' on' : ''),
        onClick: props.onClick,
        style: extraStyle
    }, props.label);
};

var PAGE_SIZE = 10;

var COLS = [
    { k:'name',       label:'User',       w:'28%' },
    { k:'role',       label:'Role',       w:'14%' },
    { k:'status',     label:'Status',     w:'12%' },
    { k:'department', label:'Dept',       w:'14%' },
    { k:'last_login', label:'Last Login', w:'13%' },
    { k:'risk',       label:'Risk',       w:'10%', ns:true },
    { k:'_a',         label:'',           w:'9%',  ns:true },
];

export var UsersTable = memo(function UsersTable(props) {
    useAdaptiveTheme();
    var users        = props.users || [];
    var onSelectUser = props.onSelectUser;
    var onEditUser   = props.onEditUser;
    var onDeleteUsers = props.onDeleteUsers;

    ensureStyles();

    var _s = useState('');      var search  = _s[0]; var setSearch  = _s[1];
    var _r = useState('all');   var roleFil = _r[0]; var setRoleFil = _r[1];
    var _t = useState('all');   var statFil = _t[0]; var setStatFil = _t[1];
    var _k = useState('name');  var sortK   = _k[0]; var setSortK   = _k[1];
    var _d = useState('asc');   var sortD   = _d[0]; var setSortD   = _d[1];
    var _e = useState(new Set()); var sel   = _e[0]; var setSel     = _e[1];
    var _p = useState(1);       var page    = _p[0]; var setPage    = _p[1];

    var filtered = useMemo(function() {
        var list = users.slice();
        if (search.trim()) {
            var q = search.toLowerCase();
            list = list.filter(function(u) {
                return (u.name||'').toLowerCase().indexOf(q) >= 0 ||
                    (u.email||'').toLowerCase().indexOf(q) >= 0 ||
                    (u.department||'').toLowerCase().indexOf(q) >= 0;
            });
        }
        if (roleFil !== 'all') {
            list = list.filter(function(u) {
                return (u.role||'').toLowerCase().replace(/\s+/g,'') === roleFil;
            });
        }
        if (statFil !== 'all') {
            list = list.filter(function(u) {
                return (u.status||'').toLowerCase() === statFil;
            });
        }
        list.sort(function(a,b) {
            var av = String(a[sortK]||'').toLowerCase();
            var bv = String(b[sortK]||'').toLowerCase();
            return sortD === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        return list;
    }, [users, search, roleFil, statFil, sortK, sortD]);

    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    var rows = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

    var doSort = useCallback(function(k) {
        if (k === sortK) setSortD(function(d) { return d==='asc'?'desc':'asc'; });
        else { setSortK(k); setSortD('asc'); }
    }, [sortK]);

    var toggleRow = useCallback(function(id, e) {
        e.stopPropagation();
        setSel(function(prev) {
            var s = new Set(prev);
            if (s.has(id)) s.delete(id); else s.add(id);
            return s;
        });
    }, []);

    var toggleAll = function() {
        setSel(function(prev) {
            return prev.size === rows.length ? new Set() : new Set(rows.map(function(u) { return u.id; }));
        });
    };

    var go = function(fn) { fn(); setPage(1); };

    var roleOpts = useMemo(function() {
        var seen = new Set(users.map(function(u) { return (u.role||'').toLowerCase().replace(/\s+/g,''); }));
        return ['superadmin','admin','editor','viewer','guest'].filter(function(r) {
            return seen.has(r) || !users.length;
        });
    }, [users]);

    var allChecked = rows.length > 0 && sel.size === rows.length;

    return React.createElement('div', { className:'ut2' },

        /* Toolbar */
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap: 20, flexWrap:'wrap', marginBottom:14 } },

            /* Search */
            React.createElement('div', { className:'ut2-search' },
                React.createElement('span', { className:'ut2-sico' },
                    React.createElement('svg', { width:13, height:13, viewBox:'0 0 24 24', fill:'none', stroke:T.textMuted, strokeWidth:'2.5', strokeLinecap:'round', strokeLinejoin:'round' },
                        React.createElement('circle', { cx:'11', cy:'11', r:'8' }),
                        React.createElement('line', { x1:'21', y1:'21', x2:'16.65', y2:'16.65' })
                    )
                ),
                React.createElement('input', {
                    id:'um-search-input', type:'text',
                    placeholder:'Search name, email, dept...',
                    value:search,
                    onChange:function(e){ go(function(){ setSearch(e.target.value); }); },
                    'aria-label':'Search users'
                })
            ),

            /* Role pills */
            React.createElement(Pill, { label:'All Roles', active:roleFil==='all', onClick:function(){ go(function(){ setRoleFil('all'); }); } }),
            roleOpts.map(function(r) {
                var c = ROLE_CFG[r];
                return React.createElement(Pill, { key:r, label:c.label, active:roleFil===r, color:c.color, bg:c.bg, onClick:function(){ go(function(){ setRoleFil(r); }); } });
            }),

            React.createElement('div', { style:{ flex:1 } }),

            /* Status pills */
            React.createElement(Pill, { label:'All Status', active:statFil==='all', onClick:function(){ go(function(){ setStatFil('all'); }); } }),
            ['active','inactive','suspended'].map(function(s) {
                var c = STATUS_CFG[s];
                return React.createElement(Pill, { key:s, label:c.label, active:statFil===s, color:c.color, bg:c.bg, onClick:function(){ go(function(){ setStatFil(s); }); } });
            }),

            /* Export */
            React.createElement('button', { className:'ut2-btn ut2-btn-g' }, 'Export'),

            /* Add User */
            React.createElement('button', {
                className:'ut2-btn ut2-btn-p',
                onClick:function(){ if(onEditUser) onEditUser(null); }
            }, '+ Add User')
        ),

        /* Meta row */
        React.createElement('div', {
                style:{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginBottom:10, fontSize:12, color:T.textMuted }
            },
            React.createElement('span', null, filtered.length + ' result' + (filtered.length!==1?'s':'')),
            sel.size > 0 && React.createElement('span', { style:{ display:'flex', alignItems:'center', gap: 20 } },
                React.createElement('span', { style:{ color:T.primary, fontWeight:600 } }, sel.size + ' selected'),
                React.createElement('button', {
                    onClick:function(){ if(onDeleteUsers) onDeleteUsers([...sel]); },
                    style:{ fontSize:11, fontWeight:600, color:T.red, background:T.red+'15',
                        border:'1px solid '+T.red+'40', borderRadius: 18, padding:'2px 8px',
                        cursor:'pointer', fontFamily:'inherit' }
                }, 'Delete selected')
            )
        ),

        /* Table */
        React.createElement('div', {
                style:{ border:'1px solid '+T.glassBorder, borderRadius:16, overflow:'hidden', background:T.surface }
            },
            React.createElement('table', { className:'ut2-tbl' },
                React.createElement('colgroup', null,
                    React.createElement('col', { style:{ width:44 } }),
                    COLS.map(function(c) { return React.createElement('col', { key:c.k, style:{ width:c.w } }); })
                ),
                React.createElement('thead', null,
                    React.createElement('tr', null,
                        React.createElement('th', null,
                            React.createElement('input', {
                                type:'checkbox', className:'ut2-cb',
                                checked:allChecked, onChange:toggleAll,
                                'aria-label':'Select all'
                            })
                        ),
                        COLS.map(function(col) {
                            return React.createElement('th', {
                                    key:col.k,
                                    className: col.ns ? '' : 's',
                                    onClick: col.ns ? undefined : function(){ doSort(col.k); }
                                },
                                col.label,
                                !col.ns && React.createElement('span', {
                                    style:{ marginLeft:3, fontSize:10,
                                        opacity: sortK===col.k ? 1 : 0.25,
                                        color: sortK===col.k ? T.primary : 'inherit' }
                                }, sortK===col.k ? (sortD==='asc' ? ' ^' : ' v') : ' ^v')
                            );
                        })
                    )
                ),
                React.createElement('tbody', null,
                    rows.length === 0
                        ? React.createElement('tr', null,
                            React.createElement('td', { colSpan:8, style:{ textAlign:'center', padding:'56px 20px' } },
                                React.createElement('div', { style:{ color:T.textMuted, fontSize:13 } },
                                    'No users found' + (search ? ' for "' + search + '"' : '')
                                )
                            )
                        )
                        : rows.map(function(u, i) {
                            var isS = sel.has(u.id);
                            var ac  = getAvatarColor(u.name);
                            return React.createElement('tr', {
                                    key: u.id || ('u'+i),
                                    className: 'ut2-in' + (isS ? ' sel' : ''),
                                    style:{ animationDelay: (i*25)+'ms' },
                                    onClick: function(){ if(onSelectUser) onSelectUser(u); }
                                },
                                /* checkbox */
                                React.createElement('td', { onClick:function(e){ toggleRow(u.id,e); } },
                                    React.createElement('input', {
                                        type:'checkbox', className:'ut2-cb',
                                        checked:isS,
                                        onChange:function(e){ toggleRow(u.id,e); },
                                        'aria-label':'Select '+u.name
                                    })
                                ),
                                /* user */
                                React.createElement('td', null,
                                    React.createElement('div', { style:{ display:'flex', alignItems:'center', gap: 22, overflow:'hidden' } },
                                        React.createElement('div', { className:'ut2-av', style:{ background:ac+'22', color:ac } },
                                            getInitials(u.name)
                                        ),
                                        React.createElement('div', { style:{ overflow:'hidden', minWidth:0 } },
                                            React.createElement('div', {
                                                style:{ fontSize:13, fontWeight:600, color:T.textMain,
                                                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }
                                            }, u.name || '--'),
                                            React.createElement('div', {
                                                style:{ fontSize:11, color:T.textMuted, marginTop:1,
                                                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }
                                            }, u.email || '')
                                        )
                                    )
                                ),
                                /* role */
                                React.createElement('td', null, React.createElement(RoleBadge, { role:u.role||'' })),
                                /* status */
                                React.createElement('td', null, React.createElement(StatusBadge, { status:u.status||'' })),
                                /* dept */
                                React.createElement('td', {
                                    style:{ fontSize:12, color:T.textDim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }
                                }, u.department || '--'),
                                /* last login */
                                React.createElement('td', {
                                    style:{ fontSize:12, color:T.textDim, fontFamily: THEME.fontMono, whiteSpace:'nowrap' }
                                }, formatDate(u.last_login)),
                                /* risk */
                                React.createElement('td', null, React.createElement(RiskCell, { risk:u.risk||'' })),
                                /* actions */
                                React.createElement('td', { onClick:function(e){ e.stopPropagation(); } },
                                    React.createElement('div', { style:{ display:'flex', gap:5 } },
                                        React.createElement('button', {
                                            className:'ut2-ib', title:'Edit',
                                            onClick:function(e){ e.stopPropagation(); if(onEditUser) onEditUser(u); }
                                        }, React.createElement(EditSVG)),
                                        React.createElement('button', {
                                            className:'ut2-ib d', title:'Delete',
                                            onClick:function(e){ e.stopPropagation(); if(onDeleteUsers) onDeleteUsers(u.id); }
                                        }, React.createElement(TrashSVG))
                                    )
                                )
                            );
                        })
                )
            )
        ),

        /* Pagination */
        React.createElement('div', {
                style:{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginTop:12, fontSize:12, color:T.textMuted }
            },
            React.createElement('span', null,
                'Showing ' + (filtered.length===0?0:(page-1)*PAGE_SIZE+1) +
                '-' + Math.min(page*PAGE_SIZE, filtered.length) +
                ' of ' + filtered.length + ' users'
            ),
            totalPages > 1 && React.createElement('div', { style:{ display:'flex', gap:5, alignItems:'center' } },
                React.createElement('button', {
                    className:'ut2-pg', disabled:page===1,
                    onClick:function(){ setPage(function(p){ return p-1; }); }
                }, '<'),
                Array.from({ length: Math.min(totalPages, 7) }, function(_, i) {
                    var p = i+1;
                    return React.createElement('button', {
                        key:p, className:'ut2-pg' + (page===p?' on':''),
                        onClick:function(){ setPage(p); }
                    }, p);
                }),
                totalPages > 7 && React.createElement('span', null, '...'),
                React.createElement('button', {
                    className:'ut2-pg', disabled:page===totalPages,
                    onClick:function(){ setPage(function(p){ return p+1; }); }
                }, '>')
            )
        )
    );
});
UsersTable.displayName = 'UsersTable';


export var PermissionMatrix = memo(function PermissionMatrix() {
    useAdaptiveTheme();
    var roles   = ['superadmin','admin','editor','viewer','guest'];
    var actions = ['View','Create','Edit','Delete','Export','Admin'];
    var perms   = {
        superadmin:[1,1,1,1,1,1],
        admin:     [1,1,1,1,1,0],
        editor:    [1,1,1,0,0,0],
        viewer:    [1,0,0,0,1,0],
        guest:     [1,0,0,0,0,0],
    };

    return React.createElement('div', { style:{ fontFamily:'inherit' } },
        React.createElement('div', { style:{ marginBottom:20 } },
            React.createElement('div', { style:{ fontSize:15, fontWeight:700, color:T.textMain } }, 'Permission Matrix'),
            React.createElement('div', { style:{ fontSize:12, color:T.textDim, marginTop:3 } }, 'Role-based access control')
        ),
        React.createElement('div', {
                style:{ overflowX:'auto', border:'1px solid '+T.glassBorder, borderRadius:16, background:T.surface }
            },
            React.createElement('table', { style:{ width:'100%', borderCollapse:'collapse', minWidth:500 } },
                React.createElement('thead', null,
                    React.createElement('tr', { style:{ background:T.surfaceMid, borderBottom:'1px solid '+T.glassBorder } },
                        React.createElement('th', { style:{ padding:'11px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:T.textMuted,  letterSpacing:'0.02em' } }, 'Role'),
                        actions.map(function(a) {
                            return React.createElement('th', { key:a, style:{ padding:'11px 14px', textAlign:'center', fontSize:11, fontWeight:700, color:T.textMuted,  letterSpacing:'0.02em' } }, a);
                        })
                    )
                ),
                React.createElement('tbody', null,
                    roles.map(function(role, ri) {
                        return React.createElement('tr', {
                                key:role,
                                style:{ borderBottom: ri < roles.length-1 ? '1px solid '+T.glassBorder+'33' : 'none' }
                            },
                            React.createElement('td', { style:{ padding:'13px 16px' } }, React.createElement(RoleBadge, { role:role })),
                            perms[role].map(function(on, ai) {
                                return React.createElement('td', { key:ai, style:{ padding:'13px 14px', textAlign:'center' } },
                                    on
                                        ? React.createElement('span', { style:{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, borderRadius: 18, background:T.green+'1a', color:T.green, fontSize:12, fontWeight:700 } }, 'Y')
                                        : React.createElement('span', { style:{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, borderRadius: 18, background:T.glassBorder+'55', color:T.textMuted, fontSize:11 } }, '-')
                                );
                            })
                        );
                    })
                )
            )
        )
    );
});
PermissionMatrix.displayName = 'PermissionMatrix';