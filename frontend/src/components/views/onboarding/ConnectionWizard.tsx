/**
 * ConnectionWizard.jsx
 * Multi-step wizard for connecting a database.
 * Steps: Type → Details → Options → Test → Success
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronLeft, CheckCircle, Loader, AlertCircle,
  Database, Key, Zap, Shield, Wifi, Globe, Lock, Plus, Trash2, Power, Circle
} from 'lucide-react';
import { postData, deleteData } from '../../../utils/api';
import ConnectionStringParser from '../../ui/ConnectionStringParser';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { useNavigation } from '../../../context/NavigationContext';
import { useConnection } from '../../../context/ConnectionContext';

const DB_TYPES = {
  postgresql: {
    label: 'PostgreSQL',
    defaultPort: 5432,
    color: '#336791',
    icon: '🐘',
    description: 'Open-source relational database'
  },
  mysql: {
    label: 'MySQL',
    defaultPort: 3306,
    color: THEME.warning,
    icon: '🐬',
    description: 'Popular relational database'
  },
  mongodb: {
    label: 'MongoDB',
    defaultPort: 27017,
    color: '#13aa52',
    icon: '🍃',
    description: 'Document-oriented database'
  },
  // ── Phase-5 engines ─────────────────────────────────────────────────────
  mssql: {
    label: 'Microsoft SQL Server',
    defaultPort: 1433,
    color: '#CC2927',
    icon: '🅼',
    description: 'Enterprise relational database'
  },
  oracle: {
    label: 'Oracle Database',
    defaultPort: 1521,
    color: '#F80000',
    icon: '🅾',
    description: 'Enterprise relational database (23ai)'
  },
  redis: {
    label: 'Redis',
    defaultPort: 6379,
    color: '#DC382D',
    icon: '🧰',
    description: 'In-memory key-value store'
  },
  elasticsearch: {
    label: 'Elasticsearch',
    defaultPort: 9200,
    color: '#00BFB3',
    icon: '🔍',
    description: 'Search + log analytics engine'
  },
  snowflake: {
    label: 'Snowflake',
    defaultPort: 443,
    color: '#29B5E8',
    icon: '❄️',
    description: 'Cloud data warehouse'
  },
  bigquery: {
    label: 'BigQuery',
    defaultPort: 443,
    color: THEME.primary,
    icon: '🔶',
    description: 'Google Cloud data warehouse'
  },
  redshift: {
    label: 'AWS Redshift',
    defaultPort: 5439,
    color: '#FF9900',
    icon: '🧊',
    description: 'AWS data warehouse (PG wire)'
  },
  cassandra: {
    label: 'Apache Cassandra',
    defaultPort: 9042,
    color: '#1287B1',
    icon: '💍',
    description: 'Wide-column distributed database'
  },
  dynamodb: {
    label: 'AWS DynamoDB',
    defaultPort: 443,
    color: '#4053D6',
    icon: '📦',
    description: 'Managed NoSQL key-value store'
  },
};

/**
 * Per-engine guidance shown above the Details form for engines whose
 * credentials don't match the standard host/port/user/password shape.
 * The backend adapters accept these mapped fields — see
 * backend/services/dbAdapters/index.js for the factory routing.
 */
const ENGINE_HINTS: Record<string, string> = {
  mssql:
    `• Host: SQL Server hostname or instance (e.g. sql.prod.acme)
• Port: 1433 (default) or your configured port
• Username / Password: SQL login, or use integrated auth via connection string
• Database: target database name (e.g. pulsedb_prod)`,
  oracle:
    `• Host: Oracle listener host
• Port: 1521 (default)
• Username / Password: Oracle user credentials
• Database: Service name or SID (e.g. PULSEDB_PDB)`,
  redis:
    `• Host: Redis primary hostname
• Port: 6379 (default) or 6380 for TLS
• Username: leave blank for legacy Redis, or ACL user for Redis ≥ 6
• Password: Redis AUTH token
• Database: logical DB index (0-15), e.g. 0`,
  elasticsearch:
    `• Host: Elasticsearch coordinator node (e.g. https://es.prod.acme)
• Port: 9200 (default)
• Username / Password: your ES basic-auth credentials
• Database: index pattern to monitor (e.g. logs-app-*)`,
  snowflake:
    `• Host: your Snowflake account identifier (e.g. acme-analytics.us-east-1.snowflakecomputing.com)
• Port: 443 (HTTPS)
• Username / Password: Snowflake user credentials (or key-pair via connection string)
• Database: target database name (e.g. PULSEDB_PROD) — configure warehouse + role post-connect`,
  bigquery:
    `• Host: GCP project ID (e.g. acme-analytics)
• Port: 443 (HTTPS)
• Username: service account email
• Password: paste the service account key JSON as the password value (or use connection string)
• Database: dataset or dataset:location (e.g. pulsedb_prod or pulsedb_prod:US)`,
  redshift:
    `• Host: your cluster endpoint (e.g. pulsedb.abc.us-east-1.redshift.amazonaws.com)
• Port: 5439 (default)
• Username / Password: Redshift user credentials
• Database: target database name (e.g. pulsedb_prod)`,
  cassandra:
    `• Host: any contact point in the cluster (e.g. cass-1.prod.acme)
• Port: 9042 (default native CQL port)
• Username / Password: credentials (blank if PasswordAuthenticator is not enabled)
• Database: default keyspace (e.g. pulsedb_app). Override the local datacenter via connection string.`,
  dynamodb:
    `• Host: AWS region (e.g. us-east-1) — DynamoDB has no traditional host
• Port: 443 (HTTPS)
• Username: AWS access key ID
• Password: AWS secret access key
• Database: table-name prefix (leave blank to monitor all tables in the region)`,
};

/**
 * Provider templates. Clicking one applies its preset to the wizard:
 *   - sets selectedType to template.dbType
 *   - turns SSL on (every hosted provider here requires it)
 *   - advances to the Details step
 *
 * Provider-specific guidance is shown on step 2 via PROVIDER_HINTS below.
 */
const PROVIDER_TEMPLATES = {
  aws_rds: {
    label: 'AWS RDS',
    icon: '☁️',
    template: {
      dbType: 'postgresql',
      hostPattern: '*.*.rds.amazonaws.com',
      ssl: true,
      hint: 'Use your RDS endpoint as the host'
    }
  },
  neon: {
    label: 'Neon',
    icon: '⚡',
    template: {
      dbType: 'postgresql',
      hostPattern: 'pg-*.neon.tech',
      ssl: true,
      hint: 'Neon requires SSL. Use your connection string above.'
    }
  },
  supabase: {
    label: 'Supabase',
    icon: '🟢',
    template: {
      dbType: 'postgresql',
      hostPattern: '*.supabase.co',
      ssl: true,
      hint: 'Supabase uses PostgreSQL. Find your credentials in Settings > Database.'
    }
  },
  planetscale: {
    label: 'PlanetScale',
    icon: '🪐',
    template: {
      dbType: 'mysql',
      hostPattern: '*.psdb.cloud',
      ssl: true,
      hint: 'PlanetScale MySQL requires SSL. Use connection string above.'
    }
  },
  mongodb_atlas: {
    label: 'MongoDB Atlas',
    icon: '🎯',
    template: {
      dbType: 'mongodb',
      hostPattern: 'cluster*.mongodb.net',
      ssl: true,
      hint: 'Use mongodb+srv:// connection string from Atlas console.'
    }
  },
};

/**
 * Provider-specific guidance shown on step 2 when a provider template was
 * selected. Keyed by the same keys as PROVIDER_TEMPLATES above.
 */
const PROVIDER_HINTS: Record<string, string> = {
  supabase:
    `Find your credentials in the Supabase dashboard → Project Settings → Database.
• Host: db.<project-ref>.supabase.co (direct) or aws-0-<region>.pooler.supabase.com (pooler — recommended for serverless)
• Port: 5432 (direct) or 6543 (transaction pooler) or 5432 (session pooler)
• Username: postgres (direct) or postgres.<project-ref> (pooler)
• Password: the password you set when you created the project
• Database: postgres
• SSL: required (already enabled by this template)
Tip: for monitoring queries that hold connections open (pg_stat_*), prefer the direct or session pooler over the transaction pooler — pgBouncer in transaction mode breaks SET LOCAL and prepared statements.`,
  neon:
    `Find your connection string in the Neon dashboard → Connection Details.
• Host: ep-<endpoint>-<region>.<region>.aws.neon.tech
• Port: 5432
• Username / Password / Database: from the Neon connection details
• SSL: required (already enabled)
Tip: Neon endpoints sleep after inactivity; the first query after sleep can take a few seconds.`,
  aws_rds:
    `Use your RDS endpoint from the AWS console → RDS → Databases → [your instance] → Connectivity & security.
• Host: <db-id>.<random>.<region>.rds.amazonaws.com
• Port: 5432 (Postgres) or 3306 (MySQL) — change the engine above if not Postgres
• Username / Password: master user credentials
• Database: your initial database name
• SSL: required for compliance; use the RDS CA bundle if you want to verify the cert.`,
  planetscale:
    `Use your branch's connection string from the PlanetScale dashboard → Branches → Connect.
• Host: aws.connect.psdb.cloud
• Port: 3306
• Username: PlanetScale-issued database user
• Password: PlanetScale-issued password
• Database: your database name
• SSL: required (already enabled).`,
  mongodb_atlas:
    `Use the mongodb+srv:// connection string from Atlas → Database → Connect → Drivers.
• Host: cluster<n>.<random>.mongodb.net
• Username / Password: database user from Atlas → Security → Database Access
• Database: any DB in the cluster (the SRV string handles host discovery)
• Note: add this server's IP to Atlas → Security → Network Access, or 0.0.0.0/0 for testing.`,
};

const ConnectionWizard = () => {
  useAdaptiveTheme();
  const [step, setStep] = useState(1); // 1: Type, 2: Details, 3: Options, 4: Test, 5: Success
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({
    type: null,
    host: '',
    port: '',
    username: '',
    password: '',
    database: '',
    ssl: false,
    sshTunnel: false,
    sshHost: '',
    sshUsername: '',
    sshPassword: '',
    sshKey: '',
  });
  const [testStatus, setTestStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [testError, setTestError] = useState(null);
  const [connectionId, setConnectionId] = useState(null);
  const [useConnectionString, setUseConnectionString] = useState(false);
  const [parsedFromString, setParsedFromString] = useState(null);
  // Which PROVIDER_TEMPLATES key (if any) was chosen on step 1. Used on step 2
  // to surface provider-specific guidance (e.g. where Supabase users find
  // their connection string).
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  /**
   * Apply a provider template: select the right engine, force SSL on, and
   * advance to the Details step. The user still fills in host/credentials
   * (or pastes a connection string) — the template just sets defaults.
   */
  const handleProviderTemplate = (key: string) => {
    const tpl = PROVIDER_TEMPLATES[key]?.template;
    if (!tpl) return;
    const dbType = tpl.dbType || 'postgresql';
    setSelectedType(dbType);
    setSelectedProvider(key);
    setFormData((f) => ({
      ...f,
      type: dbType,
      ssl: !!tpl.ssl,
      // Seed default port from DB_TYPES so the form has a sensible starting value.
      port: f.port || String(DB_TYPES[dbType]?.defaultPort ?? ''),
    }));
    setStep(2);
  };

  const { goToTab } = useNavigation();
  const { connections, activeConnectionId, switchConnection, refreshConnections } = useConnection();
  const [showWizard, setShowWizard] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleDeleteConnection = async (id) => {
    if (!window.confirm('Remove this connection?')) return;
    setDeletingId(id);
    try {
      await deleteData(`/api/connections/${id}`);
      await refreshConnections();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSwitchConnection = async (id) => {
    try {
      await switchConnection(id);
    } catch (err) {
      console.error('Switch failed:', err);
    }
  };

  // Derive icon/color from DB_TYPES so every registered engine (including
  // Phase-5 engines like BigQuery / DynamoDB / Cassandra) displays with its
  // brand glyph and color in the connection list, instead of defaulting to
  // the PostgreSQL elephant.
  const resolveDbType = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('postgres')) return 'postgresql';
    if (t.includes('mysql') || t.includes('mariadb')) return 'mysql';
    if (t.includes('mongo')) return 'mongodb';
    return DB_TYPES[t] ? t : 'postgresql';
  };

  const dbIcon = (type) => DB_TYPES[resolveDbType(type)]?.icon || '🐘';
  const dbColor = (type) => DB_TYPES[resolveDbType(type)]?.color || '#336791';

  // Step 1: Select database type
  const handleSelectType = (type) => {
    setSelectedType(type);
    // Picking a raw engine clears any previous provider-template selection,
    // so the provider-specific hint doesn't linger on the wrong engine.
    setSelectedProvider(null);
    setFormData(prev => ({
      ...prev,
      type,
      port: DB_TYPES[type].defaultPort.toString(),
    }));
    setStep(2);
  };

  // Step 2: Form input changes
  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Parse connection string
  const handleParsedConnection = (parsed) => {
    setParsedFromString(parsed);
    setFormData(prev => ({
      ...prev,
      type: parsed.type || prev.type,
      host: parsed.host,
      port: parsed.port?.toString() || prev.port,
      username: parsed.username,
      password: parsed.password,
      database: parsed.database,
      ssl: parsed.ssl || false,
    }));
  };

  // Step 3: Additional options (SSH, SSL details)
  const handleProceedToTest = () => {
    setStep(4);
  };

  // Step 4: Test connection
  const handleTestConnection = useCallback(async () => {
    setTestStatus('loading');
    setTestError(null);
    try {
      const response = await postData('/api/connections/test', {
        type: formData.type,
        host: formData.host,
        port: parseInt(formData.port),
        username: formData.username,
        password: formData.password,
        database: formData.database,
        ssl: formData.ssl,
      });

      if (response.success) {
        setTestStatus('success');
        // Create the actual connection
        handleCreateConnection();
      } else {
        setTestStatus('error');
        setTestError(response.error || 'Connection test failed');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err.message || 'Failed to test connection');
    }
  }, [formData]);

  // Create connection in database
  const handleCreateConnection = useCallback(async () => {
    try {
      const response = await postData('/api/connections', {
        type: formData.type,
        host: formData.host,
        port: parseInt(formData.port),
        username: formData.username,
        password: formData.password,
        database: formData.database,
        ssl: formData.ssl,
        name: `${DB_TYPES[formData.type].label} - ${formData.host}/${formData.database}`,
        isDefault: true, // Make it default on creation
      });

      if (response.success) {
        setConnectionId(response.connectionId || response.id);
        setStep(5); // Success screen

        // Refresh connections in context
        setTimeout(() => {
          refreshConnections();
        }, 500);
      } else {
        setTestStatus('error');
        setTestError(response.error || 'Failed to create connection');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err.message || 'Failed to create connection');
    }
  }, [formData, refreshConnections]);

  const handleBackStep = () => {
    if (step > 1) {
      setStep(step - 1);
      if (step === 4) {
        setTestStatus(null);
        setTestError(null);
      }
    }
  };

  const handleGoToDashboard = () => {
    // Navigate to the correct overview based on the connected DB type.
    // Phase-5 engines land on their bespoke demo tab until real monitoring
    // views land (each bespoke tab is a shipped Overview panel already).
    const dbType = (formData.type || 'postgresql').toLowerCase();
    const PHASE5_TO_TAB: Record<string, string> = {
      mssql:         'demo-mssql',
      oracle:        'demo-oracle',
      redis:         'demo-redis',
      elasticsearch: 'demo-elasticsearch',
      snowflake:     'demo-snowflake',
      bigquery:      'demo-bigquery',
      redshift:      'demo-redshift',
      cassandra:     'demo-cassandra',
      dynamodb:      'demo-dynamodb',
    };
    if (dbType === 'mysql' || dbType === 'mariadb') {
      goToTab('mysql-overview');
    } else if (dbType === 'mongodb') {
      goToTab('mongo-overview');
    } else if (PHASE5_TO_TAB[dbType]) {
      goToTab(PHASE5_TO_TAB[dbType]);
    } else {
      goToTab('overview');
    }
  };

  const styles = {
    container: {
      width: '100%',
      maxWidth: '700px',
      margin: '0 auto',
      padding: '40px 24px',
    },
    card: {
      padding: '32px',
      borderRadius: '20px',
      background: THEME.surface,
      border: `1px solid ${THEME.glassBorder}`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
      backdropFilter: 'blur(12px)',
      transition: 'all 0.2s ease',
    },
    stepIndicator: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '32px',
      position: 'relative',
    },
    stepDot: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px',
      fontWeight: '700',
      zIndex: 2,
      transition: 'all 0.2s',
    },
    stepDotActive: {
      background: 'linear-gradient(135deg, #3b82f6, #3b82f6)',
      color: '#ffffff',
      boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
    },
    stepDotInactive: {
      background: THEME.surfaceHover,
      border: `1px solid ${THEME.glassBorder}`,
      color: THEME.textDim,
    },
    stepDotCompleted: {
      background: THEME.success,
      color: '#ffffff',
    },
    stepLine: {
      position: 'absolute',
      top: '18px',
      left: '0',
      right: '0',
      height: '2px',
      background: THEME.glassBorder,
      zIndex: 1,
    },
    title: {
      fontSize: '22px',
      fontWeight: '700',
      color: THEME.textMain,
      marginBottom: '8px',
      fontFamily: THEME.fontBody,
    },
    description: {
      fontSize: '14px',
      color: THEME.textMuted,
      marginBottom: '24px',
      fontFamily: THEME.fontBody,
    },
    typeGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '18px',
      marginBottom: '24px',
    },
    typeCard: {
      padding: '24px 20px',
      borderRadius: '16px',
      border: `1.5px solid ${THEME.glassBorder}`,
      background: THEME.surface,
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'center',
      boxShadow: '0 6px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
      backdropFilter: 'blur(8px)',
    },
    typeCardHover: {
      borderColor: THEME.primary,
      background: 'rgba(99, 102, 241, 0.04)',
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 20px rgba(99, 102, 241, 0.15)',
    },
    typeIcon: {
      fontSize: '36px',
      marginBottom: '10px',
    },
    typeLabel: {
      fontSize: '14px',
      fontWeight: '600',
      color: THEME.textMain,
      marginBottom: '4px',
      fontFamily: THEME.fontBody,
    },
    typeDescription: {
      fontSize: '12px',
      color: THEME.textMuted,
      fontFamily: THEME.fontBody,
    },
    formSection: {
      marginBottom: '24px',
    },
    formLabel: {
      fontSize: '12px',
      fontWeight: '600',
      color: THEME.textMuted,
      marginBottom: '8px',

      letterSpacing: '0.5px',
      fontFamily: THEME.fontMono,
      display: 'block',
    },
    formInput: {
      width: '100%',
      padding: '18px 22px',
      borderRadius: '12px',
      border: `1.5px solid ${THEME.glassBorder}`,
      background: THEME.surfaceHover,
      color: THEME.textMain,
      fontSize: '13px',
      fontFamily: THEME.fontMono,
      transition: 'all 0.2s',
      boxSizing: 'border-box',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    },
    formInputFocus: {
      borderColor: THEME.primary,
      background: THEME.surface,
      boxShadow: `0 0 0 3px rgba(99, 102, 241, 0.1), 0 4px 12px rgba(99, 102, 241, 0.08)`,
      outline: 'none',
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '18px',
      marginBottom: '12px',
    },
    formFull: {
      gridColumn: '1 / -1',
    },
    toggleSection: {
      padding: '18px 16px',
      borderRadius: '12px',
      background: THEME.surfaceHover,
      border: `1px solid ${THEME.glassBorder}`,
      marginBottom: '16px',
      boxShadow: '0 6px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
      backdropFilter: 'blur(8px)',
    },
    toggleLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      color: THEME.textMain,
      fontFamily: THEME.fontBody,
    },
    toggle: {
      width: '40px',
      height: '24px',
      borderRadius: '12px',
      background: THEME.glassBorder,
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      paddingRight: '3px',
    },
    toggleActive: {
      background: THEME.primary,
      paddingRight: 'auto',
      paddingLeft: '3px',
    },
    toggleDot: {
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      background: '#fff',
      transition: 'all 0.2s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    testStatusBox: {
      padding: '22px 26px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      marginBottom: '24px',
      fontFamily: THEME.fontBody,
      boxShadow: '0 6px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
      backdropFilter: 'blur(8px)',
    },
    testStatusSuccess: {
      background: 'rgba(22, 163, 74, 0.08)',
      border: '1px solid rgba(22, 163, 74, 0.2)',
      color: THEME.success,
    },
    testStatusError: {
      background: 'rgba(220, 38, 38, 0.08)',
      border: '1px solid rgba(220, 38, 38, 0.2)',
      color: THEME.danger,
    },
    testStatusLoading: {
      background: 'rgba(99, 102, 241, 0.08)',
      border: `1px solid ${THEME.glassBorder}`,
      color: THEME.primary,
    },
    successScreen: {
      textAlign: 'center',
    },
    successIcon: {
      fontSize: '56px',
      marginBottom: '16px',
      animation: 'pulse 2s ease-in-out infinite',
    },
    buttonsContainer: {
      display: 'flex',
      gap: '14px',
      justifyContent: 'space-between',
      marginTop: '32px',
    },
    button: {
      padding: '12px 24px',
      borderRadius: '12px',
      border: 'none',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
      fontFamily: THEME.fontBody,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    buttonSecondary: {
      background: THEME.surfaceHover,
      border: `1.5px solid ${THEME.glassBorder}`,
      color: THEME.textMuted,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    },
    buttonSecondaryHover: {
      borderColor: THEME.primary,
      color: THEME.textMain,
      background: 'rgba(99, 102, 241, 0.05)',
      transform: 'translateY(-2px)',
    },
    buttonPrimary: {
      background: THEME.primary,
      border: 'none',
      color: '#ffffff',
      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    },
    buttonPrimaryHover: {
      background: THEME.primaryDark,
      boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
      transform: 'translateY(-2px)',
    },
  };

  const [hoveredType, setHoveredType] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .loading-spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .conn-row:hover { background: ${THEME.surfaceHover} !important; }
      `}</style>

      {/* ── Active Connections List ───────────────────────────────────── */}
      {connections.length > 0 && (
        <div style={{ ...styles.card, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: THEME.textMain, fontFamily: THEME.fontBody }}>
              <Database size={16} style={{ marginRight: 8, verticalAlign: -2, color: THEME.primary }} />
              Connections
            </h3>
            <button
              onClick={() => { setShowWizard(!showWizard); setStep(1); setSelectedType(null); setSelectedProvider(null); setTestStatus(null); setTestError(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: showWizard ? THEME.surfaceHover : THEME.primary,
                color: showWizard ? THEME.textMuted : '#fff',
                border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Plus size={14} /> {showWizard ? 'Cancel' : 'New Connection'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {connections.map(conn => {
              const isActive = conn.id === activeConnectionId;
              const isConnected = conn.status === 'connected' || conn.status === 'success';
              return (
                <div
                  key={conn.id}
                  className="conn-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    padding: '22px 28px', borderRadius: 16,
                    background: isActive ? `${dbColor(conn.dbType)}10` : 'transparent',
                    border: `1.5px solid ${isActive ? dbColor(conn.dbType) + '50' : THEME.glassBorder}`,
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSwitchConnection(conn.id)}
                >
                  <span style={{ fontSize: 22 }}>{dbIcon(conn.dbType)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain, fontFamily: THEME.fontBody }}>
                        {conn.name}
                      </span>
                      {isActive && (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          padding: '2px 7px', borderRadius: 18,
                          background: 'rgba(99, 102, 241, 0.2)', color: THEME.primary,
                        }}>Active</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conn.host}:{conn.port}/{conn.database}
                      <span style={{ marginLeft: 8, color: isConnected ? THEME.success : THEME.textDim }}>
                        ● {isConnected ? 'Connected' : conn.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 18,
                      background: `${dbColor(conn.dbType)}15`, color: dbColor(conn.dbType),
                      fontWeight: 600, textTransform: 'capitalize',
                    }}>
                      {(conn.dbType || 'postgresql').replace('postgresql', 'PostgreSQL').replace('mysql', 'MySQL').replace('mongodb', 'MongoDB')}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn.id); }}
                      disabled={deletingId === conn.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 30, height: 30, borderRadius: 20,
                        background: 'transparent', border: `1px solid transparent`,
                        color: THEME.textDim, cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = THEME.danger; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = THEME.textDim; e.currentTarget.style.borderColor = 'transparent'; }}
                      title="Delete connection"
                    >
                      {deletingId === conn.id ? <Loader size={14} className="loading-spinner" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Connection Wizard (shown when no connections or "New Connection" clicked) ── */}
      {(connections.length === 0 || showWizard) && <div style={styles.card}>
        {/* Step Indicator */}
        {step < 5 && (
          <div style={styles.stepIndicator}>
            <div style={styles.stepLine} />
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                style={{
                  ...styles.stepDot,
                  ...(s === step
                    ? styles.stepDotActive
                    : s < step
                    ? styles.stepDotCompleted
                    : styles.stepDotInactive),
                }}
              >
                {s < step ? '✓' : s}
              </div>
            ))}
          </div>
        )}

        {/* STEP 1: Choose DB Type */}
        {step === 1 && (
          <>
            <h2 style={styles.title}>Choose Database Type</h2>
            <p style={styles.description}>Select which database system you want to connect to.</p>

            <div style={styles.typeGrid}>
              {Object.entries(DB_TYPES).map(([key, db]) => (
                <div
                  key={key}
                  onClick={() => handleSelectType(key)}
                  onMouseEnter={() => setHoveredType(key)}
                  onMouseLeave={() => setHoveredType(null)}
                  style={{
                    ...styles.typeCard,
                    ...(hoveredType === key ? styles.typeCardHover : {}),
                  }}
                >
                  <div style={styles.typeIcon}>{db.icon}</div>
                  <div style={styles.typeLabel}>{db.label}</div>
                  <div style={styles.typeDescription}>{db.description}</div>
                </div>
              ))}
            </div>

            {/* Quick Provider Templates */}
            <div style={{ marginTop: '32px' }}>
              <label style={styles.formLabel}>Or use a provider template:</label>
              <div style={styles.typeGrid}>
                {Object.entries(PROVIDER_TEMPLATES).map(([key, provider]) => (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    style={{
                      ...styles.typeCard,
                      cursor: 'pointer',
                    }}
                    title={provider.template.hint}
                    onClick={() => handleProviderTemplate(key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleProviderTemplate(key);
                      }
                    }}
                  >
                    <div style={styles.typeIcon}>{provider.icon}</div>
                    <div style={styles.typeLabel}>{provider.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* STEP 2: Enter Connection Details */}
        {step === 2 && (
          <>
            <h2 style={styles.title}>Connection Details</h2>
            <p style={styles.description}>
              {selectedType && `Connect to your ${DB_TYPES[selectedType].label} database`}
            </p>

            {/* Provider-specific guidance when a hosted-provider template was
                selected on step 1 (Supabase, Neon, RDS, etc.). */}
            {selectedProvider && PROVIDER_HINTS[selectedProvider] && (
              <div style={{
                padding: '14px 16px', marginBottom: 16, borderRadius: 10,
                background: '#10b98114',
                borderLeft: '4px solid #10b981',
                fontSize: 13, color: THEME.textDim,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: THEME.successDark }}>
                  {PROVIDER_TEMPLATES[selectedProvider]?.icon} {PROVIDER_TEMPLATES[selectedProvider]?.label} — setup notes
                </div>
                <div style={{ whiteSpace: 'pre-line', lineHeight: 1.55 }}>{PROVIDER_HINTS[selectedProvider]}</div>
              </div>
            )}

            {/* Per-engine guidance for non-standard credential shapes. */}
            {selectedType && ENGINE_HINTS[selectedType] && (
              <div style={{
                padding: '14px 16px', marginBottom: 16, borderRadius: 10,
                background: `${DB_TYPES[selectedType].color}14`,
                borderLeft: `4px solid ${DB_TYPES[selectedType].color}`,
                fontSize: 13, color: THEME.textDim,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: DB_TYPES[selectedType].color }}>
                  {DB_TYPES[selectedType].icon} {DB_TYPES[selectedType].label} — field mapping
                </div>
                <div style={{ whiteSpace: 'pre-line', lineHeight: 1.55 }}>{ENGINE_HINTS[selectedType]}</div>
              </div>
            )}

            {/* Connection String Option */}
            <div style={styles.toggleSection}>
              <label style={styles.toggleLabel}>
                <span>Paste connection string instead?</span>
                <button
                  onClick={() => setUseConnectionString(!useConnectionString)}
                  style={{
                    ...styles.toggle,
                    ...(useConnectionString ? styles.toggleActive : {}),
                  }}
                >
                  <div style={styles.toggleDot} />
                </button>
              </label>
            </div>

            {useConnectionString ? (
              <div style={{ marginBottom: '24px' }}>
                <ConnectionStringParser onChange={handleParsedConnection} />
              </div>
            ) : (
              <div>
                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.formLabel}>Host</label>
                    <input
                      type="text"
                      placeholder="localhost"
                      value={formData.host}
                      onChange={(e) => handleFormChange('host', e.target.value)}
                      onFocus={() => setFocusedInput('host')}
                      onBlur={() => setFocusedInput(null)}
                      style={{
                        ...styles.formInput,
                        ...(focusedInput === 'host' ? styles.formInputFocus : {}),
                      }}
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>Port</label>
                    <input
                      type="number"
                      placeholder={DB_TYPES[selectedType]?.defaultPort}
                      value={formData.port}
                      onChange={(e) => handleFormChange('port', e.target.value)}
                      onFocus={() => setFocusedInput('port')}
                      onBlur={() => setFocusedInput(null)}
                      style={{
                        ...styles.formInput,
                        ...(focusedInput === 'port' ? styles.formInputFocus : {}),
                      }}
                    />
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.formLabel}>Username</label>
                    <input
                      type="text"
                      placeholder="user"
                      value={formData.username}
                      onChange={(e) => handleFormChange('username', e.target.value)}
                      onFocus={() => setFocusedInput('username')}
                      onBlur={() => setFocusedInput(null)}
                      style={{
                        ...styles.formInput,
                        ...(focusedInput === 'username' ? styles.formInputFocus : {}),
                      }}
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>Password</label>
                    <input
                      type="password"
                      placeholder="••••••"
                      value={formData.password}
                      onChange={(e) => handleFormChange('password', e.target.value)}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                      style={{
                        ...styles.formInput,
                        ...(focusedInput === 'password' ? styles.formInputFocus : {}),
                      }}
                    />
                  </div>
                </div>

                <div style={{ ...styles.formGrid, ...styles.formFull }}>
                  <label style={styles.formLabel}>Database Name</label>
                  <input
                    type="text"
                    placeholder="mydb"
                    value={formData.database}
                    onChange={(e) => handleFormChange('database', e.target.value)}
                    onFocus={() => setFocusedInput('database')}
                    onBlur={() => setFocusedInput(null)}
                    style={{
                      ...styles.formInput,
                      ...(focusedInput === 'database' ? styles.formInputFocus : {}),
                    }}
                  />
                </div>
              </div>
            )}

            <div style={styles.buttonsContainer}>
              <button
                onClick={handleBackStep}
                onMouseEnter={() => setHoveredButton('back')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  ...styles.button,
                  ...styles.buttonSecondary,
                  ...(hoveredButton === 'back' ? styles.buttonSecondaryHover : {}),
                }}
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                onMouseEnter={() => setHoveredButton('next')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  ...(hoveredButton === 'next' ? styles.buttonPrimaryHover : {}),
                }}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* STEP 3: Configure Options */}
        {step === 3 && (
          <>
            <h2 style={styles.title}>Connection Options</h2>
            <p style={styles.description}>Configure SSL and advanced options (optional).</p>

            <div style={styles.toggleSection}>
              <label style={styles.toggleLabel}>
                <Shield size={16} />
                <span>Require SSL/TLS</span>
                <button
                  onClick={() => handleFormChange('ssl', !formData.ssl)}
                  style={{
                    ...styles.toggle,
                    ...(formData.ssl ? styles.toggleActive : {}),
                  }}
                >
                  <div style={styles.toggleDot} />
                </button>
              </label>
            </div>

            <div style={styles.toggleSection}>
              <label style={styles.toggleLabel}>
                <Wifi size={16} />
                <span>Use SSH Tunnel</span>
                <button
                  onClick={() => handleFormChange('sshTunnel', !formData.sshTunnel)}
                  style={{
                    ...styles.toggle,
                    ...(formData.sshTunnel ? styles.toggleActive : {}),
                  }}
                >
                  <div style={styles.toggleDot} />
                </button>
              </label>
            </div>

            {formData.sshTunnel && (
              <div style={{ ...styles.formSection, paddingLeft: '16px', borderLeft: `2px solid ${THEME.glassBorder}` }}>
                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.formLabel}>SSH Host</label>
                    <input
                      type="text"
                      placeholder="bastion.example.com"
                      value={formData.sshHost}
                      onChange={(e) => handleFormChange('sshHost', e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>SSH Username</label>
                    <input
                      type="text"
                      placeholder="ubuntu"
                      value={formData.sshUsername}
                      onChange={(e) => handleFormChange('sshUsername', e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={styles.buttonsContainer}>
              <button
                onClick={handleBackStep}
                onMouseEnter={() => setHoveredButton('back')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  ...styles.button,
                  ...styles.buttonSecondary,
                  ...(hoveredButton === 'back' ? styles.buttonSecondaryHover : {}),
                }}
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                onClick={handleProceedToTest}
                onMouseEnter={() => setHoveredButton('test')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  ...(hoveredButton === 'test' ? styles.buttonPrimaryHover : {}),
                }}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* STEP 4: Test Connection */}
        {step === 4 && (
          <>
            <h2 style={styles.title}>Test Connection</h2>
            <p style={styles.description}>Verify that PulseDB can connect to your database.</p>

            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  ...styles.formSection,
                  padding: '16px',
                  background: THEME.surfaceHover,
                  border: `1px solid ${THEME.glassBorder}`,
                  borderRadius: '10px',
                }}
              >
                <div style={{ fontSize: '12px', color: THEME.textMuted, fontFamily: THEME.fontMono }}>
                  <div>Type: <strong>{DB_TYPES[formData.type]?.label}</strong></div>
                  <div>Host: <strong>{formData.host}</strong>:{formData.port}</div>
                  <div>Database: <strong>{formData.database}</strong></div>
                  <div>SSL: {formData.ssl ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>
            </div>

            {testStatus === 'loading' && (
              <div style={{ ...styles.testStatusBox, ...styles.testStatusLoading }}>
                <Loader className="loading-spinner" size={20} />
                <span>Testing connection...</span>
              </div>
            )}

            {testStatus === 'success' && (
              <div style={{ ...styles.testStatusBox, ...styles.testStatusSuccess }}>
                <CheckCircle size={20} />
                <span>Connection successful! Creating connection...</span>
              </div>
            )}

            {testStatus === 'error' && (
              <div style={{ ...styles.testStatusBox, ...styles.testStatusError }}>
                <AlertCircle size={20} />
                <div>
                  <div>Connection failed</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>{testError}</div>
                </div>
              </div>
            )}

            <div style={styles.buttonsContainer}>
              <button
                onClick={handleBackStep}
                disabled={testStatus === 'loading'}
                onMouseEnter={() => setHoveredButton('back')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  ...styles.button,
                  ...styles.buttonSecondary,
                  ...(hoveredButton === 'back' ? styles.buttonSecondaryHover : {}),
                  opacity: testStatus === 'loading' ? 0.5 : 1,
                  cursor: testStatus === 'loading' ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'loading' || testStatus === 'success'}
                onMouseEnter={() => setHoveredButton('test')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  ...(hoveredButton === 'test' ? styles.buttonPrimaryHover : {}),
                  opacity: (testStatus === 'loading' || testStatus === 'success') ? 0.6 : 1,
                  cursor: (testStatus === 'loading' || testStatus === 'success') ? 'not-allowed' : 'pointer',
                }}
              >
                {testStatus === 'loading' ? (
                  <>
                    <Loader className="loading-spinner" size={16} />
                    Testing...
                  </>
                ) : testStatus === 'success' ? (
                  <>
                    <CheckCircle size={16} />
                    Success
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Test Connection
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* STEP 5: Success */}
        {step === 5 && (
          <div style={styles.successScreen}>
            <div style={styles.successIcon}>✨</div>
            <h2 style={styles.title}>Connection Established!</h2>
            <p style={styles.description}>
              Your database connection is ready. You can now start monitoring your database with PulseDB.
            </p>

            <button
              onClick={handleGoToDashboard}
              onMouseEnter={() => setHoveredButton('dashboard')}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(hoveredButton === 'dashboard' ? styles.buttonPrimaryHover : {}),
                marginTop: '24px',
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={16} />
              Go to Dashboard
            </button>
          </div>
        )}
      </div>}
    </div>
  );
};

export default ConnectionWizard;
