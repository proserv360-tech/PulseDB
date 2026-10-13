import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, X, Moon, Sun, ArrowRight, Download, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '../../context/NavigationContext';
import { getTabsOnly, buildTabConfig } from '../../config/tabConfig';
import { getDS } from '../../config/designTokens';

interface CommandItem {
    id: string;
    label: string;
    category: 'tab' | 'action';
    icon?: React.ReactNode;
    onSelect: () => void;
}

const CommandPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { isDark, toggleTheme } = useTheme();
    const { goToTab } = useNavigation();
    const ds = getDS();
    const tabs = getTabsOnly(buildTabConfig());

    // Build command items
    const commandItems: CommandItem[] = [
        // Tab navigation items
        ...tabs.map((tab) => ({
            id: `tab-${tab.id}`,
            label: tab.label,
            category: 'tab' as const,
            icon: tab.icon,
            onSelect: () => {
                goToTab(tab.id);
                setIsOpen(false);
                setQuery('');
            },
        })),
        // Action items
        // (Dark-mode toggle removed — the app is light-only.)
        {
            id: 'export-dashboard',
            label: 'Export Dashboard',
            category: 'action' as const,
            icon: <Download size={16} />,
            onSelect: () => {
                // TODO: wire up export functionality (placeholder action).
                setIsOpen(false);
                setQuery('');
            },
        },
        {
            id: 'refresh-data',
            label: 'Refresh Data',
            category: 'action' as const,
            icon: <RefreshCw size={16} />,
            onSelect: () => {
                // TODO: wire up refresh functionality (placeholder action).
                setIsOpen(false);
                setQuery('');
            },
        },
    ];

    // Filter items by search query
    const filteredItems = commandItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

    // Reset selected index when filtered items change
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Open palette with Ctrl+K or Cmd+K
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
                setQuery('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle palette navigation and actions
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    setIsOpen(false);
                    setQuery('');
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredItems[selectedIndex]) {
                        filteredItems[selectedIndex].onSelect();
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, filteredItems]);

    // Focus input when palette opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Handle click outside
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setIsOpen(false);
            setQuery('');
        }
    };

    const bgColor = ds.surface;
    const textColor = ds.textPrimary;
    const borderColor = ds.border;
    const hoverBg = ds.surfaceHover;
    const accentColor = ds.cyan;

    if (!isOpen) return null;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '20vh',
                zIndex: 9999,
                backdropFilter: 'blur(4px)',
            }}
            onClick={handleBackdropClick}
        >
            <div
                style={{
                    backgroundColor: bgColor,
                    borderRadius: '8px',
                    border: `1px solid ${borderColor}`,
                    boxShadow: isDark ? '0 25px 50px rgba(0, 0, 0, 0.5)' : '0 25px 50px rgba(0, 0, 0, 0.15)',
                    width: '90%',
                    maxWidth: '500px',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '16px',
                        borderBottom: `1px solid ${borderColor}`,
                    }}
                >
                    <Search size={18} color={accentColor} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search tabs and actions..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                            flex: 1,
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: textColor,
                            fontSize: '16px',
                            fontFamily: 'inherit',
                            outline: 'none',
                            padding: 0,
                        }}
                    />
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setQuery('');
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: textColor,
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Command List */}
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item, index) => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    item.onSelect();
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                                style={{
                                    padding: '12px 16px',
                                    backgroundColor: selectedIndex === index ? hoverBg : 'transparent',
                                    color: textColor,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'background-color 150ms ease',
                                }}
                            >
                                {item.icon && (
                                    <div style={{ color: accentColor, display: 'flex', alignItems: 'center' }}>
                                        {item.icon}
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: '14px',
                                            fontWeight: item.category === 'tab' ? 500 : 400,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {item.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '11px',
                                            color: ds.textMuted,
                                            marginTop: '2px',
                                        }}
                                    >
                                        {item.category === 'tab' ? 'Navigate' : 'Action'}
                                    </div>
                                </div>
                                {selectedIndex === index && <ArrowRight size={14} color={accentColor} />}
                            </div>
                        ))
                    ) : (
                        <div
                            style={{
                                padding: '32px 16px',
                                textAlign: 'center',
                                color: ds.textMuted,
                                fontSize: '14px',
                            }}
                        >
                            No results found
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '12px 16px',
                        borderTop: `1px solid ${borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: ds.textMuted,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Command size={12} />
                        <span>K</span>
                    </div>
                    <span>to open</span>
                    <span style={{ marginLeft: 'auto' }}>↑↓ to navigate • Enter to select • Esc to close</span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
