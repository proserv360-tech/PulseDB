import { useState, useEffect, useCallback } from 'react';

export interface QueryEntry {
  id: string;
  sql: string;
  timestamp: number;
  executionTime?: number;
  rowCount?: number;
  database?: string;
  bookmarked: boolean;
  label?: string;
}

export interface UseQueryHistoryReturn {
  history: QueryEntry[];
  bookmarks: QueryEntry[];
  addQuery: (sql: string, meta?: { executionTime?: number; rowCount?: number; database?: string }) => void;
  toggleBookmark: (id: string) => void;
  updateLabel: (id: string, label: string) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
  searchHistory: (query: string) => QueryEntry[];
}

const STORAGE_KEY = 'fathom_query_history';
const DEFAULT_MAX_ENTRIES = 100;

const generateId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
};

const fuzzyMatch = (text: string, pattern: string): boolean => {
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();
  let patternIndex = 0;

  for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIndex]) {
      patternIndex++;
    }
  }

  return patternIndex === patternLower.length;
};

export function useQueryHistory(maxEntries: number = DEFAULT_MAX_ENTRIES): UseQueryHistoryReturn {
  const [history, setHistory] = useState<QueryEntry[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage whenever history changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      } catch (error) {
        console.error('Failed to save query history:', error);
      }
    }
  }, [history, isHydrated]);

  const addQuery = useCallback(
    (sql: string, meta?: { executionTime?: number; rowCount?: number; database?: string }) => {
      setHistory((prev) => {
        // Deduplicate consecutive identical queries
        if (prev.length > 0 && prev[0].sql === sql) {
          return prev;
        }

        const newEntry: QueryEntry = {
          id: generateId(),
          sql,
          timestamp: Date.now(),
          bookmarked: false,
          ...meta,
        };

        let updated = [newEntry, ...prev];

        // Auto-trim oldest non-bookmarked entries if exceeded
        if (updated.length > maxEntries) {
          const bookmarked = updated.filter((e) => e.bookmarked);
          const nonBookmarked = updated.filter((e) => !e.bookmarked);
          const toKeep = maxEntries - bookmarked.length;

          if (toKeep > 0) {
            updated = [...bookmarked, ...nonBookmarked.slice(0, toKeep)];
          } else {
            updated = bookmarked;
          }
        }

        return updated;
      });
    },
    [maxEntries]
  );

  const toggleBookmark = useCallback((id: string) => {
    setHistory((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, bookmarked: !entry.bookmarked } : entry
      )
    );
  }, []);

  const updateLabel = useCallback((id: string, label: string) => {
    setHistory((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, label: label || undefined } : entry))
    );
  }, []);

  const removeEntry = useCallback((id: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory((prev) => prev.filter((entry) => entry.bookmarked));
  }, []);

  const searchHistory = useCallback((query: string): QueryEntry[] => {
    return history.filter(
      (entry) =>
        fuzzyMatch(entry.sql, query) || (entry.label && fuzzyMatch(entry.label, query))
    );
  }, [history]);

  const bookmarks = history.filter((entry) => entry.bookmarked);

  return {
    history,
    bookmarks,
    addQuery,
    toggleBookmark,
    updateLabel,
    removeEntry,
    clearHistory,
    searchHistory,
  };
}
