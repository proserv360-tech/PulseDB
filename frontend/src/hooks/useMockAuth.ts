// Fixed useMockAuth hook with password validation and localStorage persistence

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEYS = {
    USER: 'pg_monitor_user',
    ALL_USERS: 'pg_monitor_all_users',
};

const ROLE_PERMISSIONS = {
    super_admin: [
        'fleet-overview',
        'overview',
        'performance',
        'resources',
        'reliability',
        'alerts',
        'alert-rules',
        'alert-correlation',
        'optimizer',
        'indexes',
        'regression',
        'bloat',
        'Table',
        'schema',
        'table-dependencies',
        'chart-builder',
        'pool',
        'pool-metrics',
        'replication',
        'checkpoint',
        'maintenance',
        'capacity',
        'backup',
        'security',
        'observability-hub',
        'cloudwatch',
        'log-patterns',
        'opentelemetry',
        'kubernetes',
        'status-page',
        'ai-monitoring',
        'sql',
        'api',
        'repository',
        'ai-advisor',
        'mongo-overview',
        'mongo-performance',
        'mongo-storage',
        'mongo-replication',
        'mongo-data-tools',
        'mongo-sharding',
        'demo-postgres',
        'demo-mysql',
        'demo-mongodb',
        'tasks',
        'UserManagement',
        'admin',
        'retention',
        'report-builder',
        'terraform',
        'custom-dashboard',
    ],
    admin: [
        'fleet-overview',
        'overview',
        'performance',
        'resources',
        'reliability',
        'alerts',
        'alert-rules',
        'alert-correlation',
        'optimizer',
        'indexes',
        'regression',
        'bloat',
        'Table',
        'schema',
        'table-dependencies',
        'chart-builder',
        'pool',
        'pool-metrics',
        'replication',
        'checkpoint',
        'maintenance',
        'capacity',
        'backup',
        'security',
        'observability-hub',
        'cloudwatch',
        'log-patterns',
        'opentelemetry',
        'kubernetes',
        'status-page',
        'ai-monitoring',
        'sql',
        'api',
        'repository',
        'ai-advisor',
        'mongo-overview',
        'mongo-performance',
        'mongo-storage',
        'mongo-replication',
        'mongo-data-tools',
        'mongo-sharding',
        'demo-postgres',
        'demo-mysql',
        'demo-mongodb',
        'tasks',
        'admin',
        'retention',
        'report-builder',
        'terraform',
        'custom-dashboard',
    ],
    user: [
        'overview',
        'performance',
        'resources',
        'reliability',
        'alerts',
        'optimizer',
        'indexes',
        'regression',
        'bloat',
        'Table',
        'pool',
        'replication',
        'checkpoint',
        'maintenance',
        'schema',
        'cloudwatch',
        'log-patterns',
        'sql',
        'api',
        'repository',
        'mongo-overview',
        'mongo-performance',
        'mongo-storage',
        'mongo-replication',
        'mongo-data-tools',
        'mongo-sharding',
    ],
    viewer: [
        'overview',
        'performance',
        'resources',
        'reliability',
        'mongo-overview',
        'mongo-performance',
        'mongo-storage',
    ],
};

export const useMockAuth = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load current user from localStorage on mount — always refresh allowedScreens
    // from the latest ROLE_PERMISSIONS so newly-added tabs appear without re-login.
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                const latestScreens = ROLE_PERMISSIONS[parsed.role] || ROLE_PERMISSIONS.viewer;
                if (latestScreens) {
                    parsed.allowedScreens = latestScreens;
                    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(parsed));
                }
                setCurrentUser(parsed);
            }
        } catch (error) {
            console.error('Error loading current user:', error);
        } finally {
            setIsInitializing(false);
        }
    }, []);

    // Get all users from localStorage
    const getAllUsers = useCallback(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.ALL_USERS);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }

        // Return default admin if no users exist
        return [
            {
                id: 1,
                name: 'System Administrator',
                email: 'admin',
                password: 'admin', // Default password
                role: 'super_admin',
                status: 'active',
                createdAt: new Date().toISOString(),
                allowedScreens: ROLE_PERMISSIONS.super_admin,
            },
        ];
    }, []);

    const login = useCallback(
        async (loginId, password) => {
            setLoading(true);
            setError(null);

            return new Promise((resolve) => {
                setTimeout(() => {
                    // Get all users from localStorage
                    const allUsers = getAllUsers();

                    // Find user by email or username
                    const foundUser = allUsers.find((u) => u.email.toLowerCase() === loginId.toLowerCase());

                    if (!foundUser) {
                        setError('Invalid credentials. User not found.');
                        setLoading(false);
                        resolve(false);
                        return;
                    }

                    // Check if user is active
                    if (foundUser.status === 'inactive') {
                        setError('This account has been deactivated. Please contact an administrator.');
                        setLoading(false);
                        resolve(false);
                        return;
                    }

                    // Validate password
                    if (foundUser.password !== password) {
                        setError('Invalid credentials. Incorrect password.');
                        setLoading(false);
                        resolve(false);
                        return;
                    }

                    // Create user session (without password)
                    const userSession = {
                        id: foundUser.id,
                        name: foundUser.name,
                        email: foundUser.email,
                        role: foundUser.role,
                        accessLevel: foundUser.role === 'super_admin' || foundUser.role === 'admin' ? 'write' : 'read',
                        allowedScreens: foundUser.allowedScreens || [],
                        status: foundUser.status,
                    };

                    // Save to state and localStorage
                    setCurrentUser(userSession);
                    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userSession));

                    setLoading(false);
                    resolve(true);
                }, 1000); // Simulate network delay
            });
        },
        [getAllUsers],
    );

    const googleLogin = useCallback(async (email, name) => {
        setLoading(true);
        return new Promise((resolve) => {
            setTimeout(() => {
                const googleUser = {
                    id: 999 + Math.floor(Math.random() * 1000),
                    email: email || 'google_user@gmail.com',
                    name: name || 'Google User',
                    role: 'viewer',
                    accessLevel: 'read',
                    allowedScreens: ROLE_PERMISSIONS.viewer,
                    status: 'active',
                };

                setCurrentUser(googleUser);
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(googleUser));
                setLoading(false);
                resolve(true);
            }, 1500);
        });
    }, []);

    const logout = useCallback(() => {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEYS.USER);
    }, []);

    const updateUser = useCallback(
        (updatedData) => {
            if (!currentUser) return;

            const updatedUser = { ...currentUser, ...updatedData };
            setCurrentUser(updatedUser);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));

            // Also update in all users list
            try {
                const allUsers = getAllUsers();
                const updatedAllUsers = allUsers.map((u) => (u.id === currentUser.id ? { ...u, ...updatedData } : u));
                localStorage.setItem(STORAGE_KEYS.ALL_USERS, JSON.stringify(updatedAllUsers));
            } catch (error) {
                console.error('Error updating user in all users list:', error);
            }
        },
        [currentUser, getAllUsers],
    );

    return {
        currentUser,
        isInitializing,
        loading,
        error,
        login,
        googleLogin,
        logout,
        updateUser,
        getAllUsers,
    };
};