/**
 * ConnectionStringParser.jsx
 * Parses connection strings (postgresql://, mysql://, mongodb+srv://)
 * and auto-fills wizard form fields via onChange callback.
 */
import React, { useState, useCallback } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { THEME, useAdaptiveTheme } from '../../utils/theme';

const ConnectionStringParser = ({ onChange, onError }) => {
  useAdaptiveTheme();
  const [connectionString, setConnectionString] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  /**
   * Parse connection string formats:
   * PostgreSQL: postgresql://user:pass@host:port/database?sslmode=require
   * MySQL: mysql://user:pass@host:port/database
   * MongoDB SRV: mongodb+srv://user:pass@cluster.mongodb.net/database?retryWrites=true
   * MongoDB Standard: mongodb://user:pass@host:port/database
   */
  const parseConnectionString = useCallback((str) => {
    if (!str.trim()) {
      setParsedData(null);
      setError(null);
      return;
    }

    try {
      const url = new URL(str.trim());
      const protocol = url.protocol.replace(':', '');

      let dbType = null;
      if (protocol === 'postgresql' || protocol === 'postgres') {
        dbType = 'postgresql';
      } else if (protocol === 'mysql' || protocol === 'mysql2') {
        dbType = 'mysql';
      } else if (protocol === 'mongodb' || protocol === 'mongodb+srv') {
        dbType = 'mongodb';
      } else {
        throw new Error(`Unsupported protocol: ${protocol}`);
      }

      const username = url.username || '';
      const password = url.password || '';
      const hostname = url.hostname || '';
      const port = url.port || '';
      const database = url.pathname?.slice(1) || ''; // Remove leading /

      // Parse query parameters
      const params = Object.fromEntries(url.searchParams);
      const sslmode = params.sslmode || params.ssl || '';
      const useSSL = sslmode === 'require' || sslmode === 'true';

      const parsed = {
        type: dbType,
        host: hostname,
        port: port || getDefaultPort(dbType),
        username,
        password,
        database,
        ssl: useSSL,
        sslmode: sslmode,
        rawParams: params,
      };

      setParsedData(parsed);
      setError(null);

      // Call onChange with parsed fields
      if (onChange) {
        onChange(parsed);
      }

      return parsed;
    } catch (err) {
      const errorMsg = `Invalid connection string: ${err.message}`;
      setError(errorMsg);
      setParsedData(null);
      if (onError) {
        onError(errorMsg);
      }
      return null;
    }
  }, [onChange, onError]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setConnectionString(value);
    parseConnectionString(value);
  };

  const handleCopyField = (label, value) => {
    navigator.clipboard.writeText(value);
    setCopiedIndex(label);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getDefaultPort = (dbType) => {
    const ports = {
      postgresql: 5432,
      mysql: 3306,
      mongodb: 27017,
    };
    return ports[dbType] || '';
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      width: '100%',
    },
    label: {
      fontSize: '12px',
      fontWeight: '600',
      color: THEME.textMuted,
      letterSpacing: '0.5px',
      fontFamily: THEME.fontMono,
    },
    textarea: {
      width: '100%',
      padding: '12px',
      borderRadius: '8px',
      border: `1px solid rgba(99, 102, 241, 0.15)`,
      background: THEME.surfaceHover,
      color: THEME.textMain,
      fontSize: '12px',
      fontFamily: THEME.fontMono,
      lineHeight: '1.5',
      minHeight: '100px',
      resize: 'vertical',
      transition: 'all 0.2s',
      boxSizing: 'border-box',
    },
    textareaFocus: {
      borderColor: THEME.primary,
      background: THEME.surface,
      boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
      outline: 'none',
    },
    errorBox: {
      padding: '12px',
      borderRadius: '8px',
      background: 'rgba(255, 69, 96, 0.08)',
      border: '1px solid rgba(255, 69, 96, 0.2)',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
    },
    errorText: {
      fontSize: '12px',
      color: THEME.danger,
      fontFamily: THEME.fontBody,
    },
    parsedSection: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '12px',
    },
    fieldCard: {
      padding: '12px',
      borderRadius: '8px',
      background: 'rgba(99, 102, 241, 0.05)',
      border: '1px solid rgba(99, 102, 241, 0.12)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    fieldLabel: {
      fontSize: '11px',
      fontWeight: '600',
      color: THEME.textMuted,
      letterSpacing: '0.3px',
      fontFamily: THEME.fontMono,
    },
    fieldValue: {
      fontSize: '13px',
      color: THEME.textMain,
      fontWeight: '500',
      fontFamily: THEME.fontMono,
      wordBreak: 'break-all',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    copyButton: {
      background: 'none',
      border: 'none',
      color: 'rgba(99, 102, 241, 0.6)',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      transition: 'all 0.2s',
      flexShrink: 0,
    },
    copyButtonHover: {
      background: 'rgba(99, 102, 241, 0.1)',
      color: THEME.primary,
    },
    successText: {
      fontSize: '11px',
      color: THEME.secondaryDark,
      fontWeight: '500',
      fontFamily: THEME.fontMono,
    },
  };

  const [focused, setFocused] = React.useState(false);

  return (
    <div style={styles.container}>
      <div>
        <label style={styles.label}>Connection String</label>
        <textarea
          value={connectionString}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="postgresql://user:password@host:5432/database&#10;mysql://user:password@host:3306/database&#10;mongodb+srv://user:password@cluster.mongodb.net/database"
          style={{
            ...styles.textarea,
            ...(focused ? styles.textareaFocus : {}),
          }}
        />
      </div>

      {error && (
        <div style={styles.errorBox}>
          <AlertCircle size={16} color={THEME.danger} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={styles.errorText}>{error}</div>
        </div>
      )}

      {parsedData && (
        <div>
          <label style={styles.label}>Parsed Connection Details</label>
          <div style={styles.parsedSection}>
            {[
              { label: 'Type', value: parsedData.type, key: 'type' },
              { label: 'Host', value: parsedData.host, key: 'host' },
              { label: 'Port', value: parsedData.port, key: 'port' },
              { label: 'Database', value: parsedData.database, key: 'database' },
              { label: 'Username', value: parsedData.username, key: 'username' },
              { label: 'Password', value: parsedData.password ? '••••••••' : '(none)', key: 'password' },
              { label: 'SSL', value: parsedData.ssl ? 'Required' : 'Optional', key: 'ssl' },
            ].map((field) => (
              <div key={field.key} style={styles.fieldCard}>
                <div style={styles.fieldLabel}>{field.label}</div>
                <div style={styles.fieldValue}>
                  <span>{field.value}</span>
                  {field.value && field.value !== '(none)' && (
                    <button
                      onClick={() => handleCopyField(field.key, field.value)}
                      style={{
                        ...styles.copyButton,
                        ...(copiedIndex === field.key ? styles.copyButtonHover : {}),
                      }}
                      title="Copy to clipboard"
                    >
                      {copiedIndex === field.key ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  )}
                </div>
                {copiedIndex === field.key && (
                  <div style={styles.successText}>Copied!</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStringParser;
