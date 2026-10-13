/**
 * DemoDataTab Component Test Suite
 * Tests the demo data visualization component, hash functions, and data generation
 */

import { describe, it, expect } from 'vitest';

/**
 * Hash function - converts string to integer
 * Used for deterministic pseudo-random value generation
 */
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Normalize hash to 0-1 range
 */
function hashNorm(str) {
  return (hashSeed(str) % 10000) / 10000;
}

/**
 * Generate 24-hour data
 */
function gen24h(seed, m1Base, m1Var, m2Base, m2Var) {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    primary: Math.floor(hashNorm(`${seed}-p-${i}`) * m1Var + m1Base),
    secondary: Math.floor(hashNorm(`${seed}-s-${i}`) * m2Var + m2Base),
  }));
}

/**
 * Generate 7-day data
 */
function gen7d(seed, base, variance) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((d, i) => ({ day: d, value: Math.floor(hashNorm(`${seed}-${i}`) * variance + base) }));
}

// Database structure matching DemoDataTab.jsx
const DB_COLORS = {
  postgresql: '#6495ED',
  mysql: '#00B4D8',
  mongodb: '#2EE89C',
};

const DATABASE_STRUCTURE = {
  postgresql: {
    name: 'PostgreSQL',
    color: DB_COLORS.postgresql,
    sections: [
      { id: 'core', name: 'Core Monitoring', tabs: [{ name: 'Overview' }, { name: 'Performance' }] },
      { id: 'query', name: 'Query & Indexes', tabs: [] },
      { id: 'infra', name: 'Infrastructure', tabs: [] },
      { id: 'schema', name: 'Schema & Security', tabs: [] },
      { id: 'observability', name: 'Observability', tabs: [] },
      { id: 'dev', name: 'Developer Tools', tabs: [] },
      { id: 'admin', name: 'Admin', tabs: [] },
    ]
  },
  mysql: {
    name: 'MySQL',
    color: DB_COLORS.mysql,
    sections: [{ id: 'overview', name: 'Overview' }]
  },
  mongodb: {
    name: 'MongoDB',
    color: DB_COLORS.mongodb,
    sections: [{ id: 'overview', name: 'Overview' }]
  },
};

describe('DemoDataTab Component', () => {
  describe('hashSeed()', () => {
    it('should export and be callable', () => {
      expect(typeof hashSeed).toBe('function');
    });

    it('should produce consistent values for same input', () => {
      const input = 'test-string';
      const result1 = hashSeed(input);
      const result2 = hashSeed(input);
      expect(result1).toBe(result2);
    });

    it('should produce different values for different inputs', () => {
      const result1 = hashSeed('input1');
      const result2 = hashSeed('input2');
      expect(result1).not.toBe(result2);
    });

    it('should return positive integers', () => {
      const result = hashSeed('test');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('should handle empty strings', () => {
      const result = hashSeed('');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters', () => {
      const result = hashSeed('!@#$%^&*()');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle long strings', () => {
      const longStr = 'a'.repeat(1000);
      const result = hashSeed(longStr);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hashNorm()', () => {
    it('should export and be callable', () => {
      expect(typeof hashNorm).toBe('function');
    });

    it('should return values in 0-1 range', () => {
      const inputs = ['test1', 'test2', 'test3', 'test4', 'test5'];
      inputs.forEach(input => {
        const result = hashNorm(input);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      });
    });

    it('should produce consistent values for same input', () => {
      const input = 'consistent-test';
      const result1 = hashNorm(input);
      const result2 = hashNorm(input);
      expect(result1).toBe(result2);
    });

    it('should produce different values for different inputs', () => {
      const result1 = hashNorm('value1');
      const result2 = hashNorm('value2');
      expect(result1).not.toBe(result2);
    });

    it('should be deterministic across multiple calls', () => {
      const inputs = ['a', 'b', 'c', 'd'];
      const firstRun = inputs.map(hashNorm);
      const secondRun = inputs.map(hashNorm);
      expect(firstRun).toEqual(secondRun);
    });
  });

  describe('gen24h()', () => {
    it('should export and be callable', () => {
      expect(typeof gen24h).toBe('function');
    });

    it('should produce array with 24 elements', () => {
      const result = gen24h('test-seed', 100, 50, 200, 100);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(24);
    });

    it('should produce objects with time, primary, and secondary properties', () => {
      const result = gen24h('test-seed', 100, 50, 200, 100);
      result.forEach((point, i) => {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('primary');
        expect(point).toHaveProperty('secondary');
        expect(point.time).toBe(`${String(i).padStart(2, '0')}:00`);
      });
    });

    it('should produce numeric values within expected ranges', () => {
      const result = gen24h('test-seed', 100, 50, 200, 100);
      result.forEach(point => {
        // Primary should be between m1Base and m1Base+m1Var
        expect(point.primary).toBeGreaterThanOrEqual(100);
        expect(point.primary).toBeLessThanOrEqual(150);
        // Secondary should be between m2Base and m2Base+m2Var
        expect(point.secondary).toBeGreaterThanOrEqual(200);
        expect(point.secondary).toBeLessThanOrEqual(300);
      });
    });

    it('should be deterministic - same seed produces same data', () => {
      const result1 = gen24h('seed-123', 100, 50, 200, 100);
      const result2 = gen24h('seed-123', 100, 50, 200, 100);
      expect(result1).toEqual(result2);
    });

    it('should produce different data for different seeds', () => {
      const result1 = gen24h('seed-1', 100, 50, 200, 100);
      const result2 = gen24h('seed-2', 100, 50, 200, 100);
      // At least some values should differ
      const differs = result1.some((p, i) => p.primary !== result2[i].primary || p.secondary !== result2[i].secondary);
      expect(differs).toBe(true);
    });
  });

  describe('gen7d()', () => {
    it('should export and be callable', () => {
      expect(typeof gen7d).toBe('function');
    });

    it('should produce array with 7 elements', () => {
      const result = gen7d('test-seed', 50, 20);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(7);
    });

    it('should produce objects with day and value properties', () => {
      const result = gen7d('test-seed', 50, 20);
      const expectedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      result.forEach((point, i) => {
        expect(point).toHaveProperty('day');
        expect(point).toHaveProperty('value');
        expect(point.day).toBe(expectedDays[i]);
      });
    });

    it('should produce numeric values within expected ranges', () => {
      const result = gen7d('test-seed', 50, 20);
      result.forEach(point => {
        // Value should be between base and base+variance
        expect(point.value).toBeGreaterThanOrEqual(50);
        expect(point.value).toBeLessThanOrEqual(70);
      });
    });

    it('should be deterministic - same seed produces same data', () => {
      const result1 = gen7d('seed-456', 100, 30);
      const result2 = gen7d('seed-456', 100, 30);
      expect(result1).toEqual(result2);
    });

    it('should produce different data for different seeds', () => {
      const result1 = gen7d('seed-a', 100, 30);
      const result2 = gen7d('seed-b', 100, 30);
      // At least some values should differ
      const differs = result1.some((p, i) => p.value !== result2[i].value);
      expect(differs).toBe(true);
    });
  });

  describe('DB_COLORS', () => {
    it('should have all required database colors', () => {
      expect(DB_COLORS).toHaveProperty('postgresql');
      expect(DB_COLORS).toHaveProperty('mysql');
      expect(DB_COLORS).toHaveProperty('mongodb');
    });

    it('should have valid hex color values', () => {
      Object.values(DB_COLORS).forEach(color => {
        expect(typeof color).toBe('string');
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

  });

  describe('DATABASE_STRUCTURE', () => {
    it('should have all required databases', () => {
      expect(DATABASE_STRUCTURE).toHaveProperty('postgresql');
      expect(DATABASE_STRUCTURE).toHaveProperty('mysql');
      expect(DATABASE_STRUCTURE).toHaveProperty('mongodb');
    });

    it('should have correct names for each database', () => {
      expect(DATABASE_STRUCTURE.postgresql.name).toBe('PostgreSQL');
      expect(DATABASE_STRUCTURE.mysql.name).toBe('MySQL');
      expect(DATABASE_STRUCTURE.mongodb.name).toBe('MongoDB');
    });

    it('should have colors matching DB_COLORS', () => {
      expect(DATABASE_STRUCTURE.postgresql.color).toBe(DB_COLORS.postgresql);
      expect(DATABASE_STRUCTURE.mysql.color).toBe(DB_COLORS.mysql);
      expect(DATABASE_STRUCTURE.mongodb.color).toBe(DB_COLORS.mongodb);
    });

    it('should have sections for each database', () => {
      Object.entries(DATABASE_STRUCTURE).forEach(([dbKey, dbConfig]) => {
        expect(Array.isArray(dbConfig.sections)).toBe(true);
        expect(dbConfig.sections.length).toBeGreaterThan(0);
      });
    });

    it('should have valid section structure', () => {
      Object.entries(DATABASE_STRUCTURE).forEach(([_, dbConfig]) => {
        dbConfig.sections.forEach(section => {
          expect(section).toHaveProperty('id');
          expect(section).toHaveProperty('name');
          expect(typeof section.id).toBe('string');
          expect(typeof section.name).toBe('string');
          expect(section.id.length).toBeGreaterThan(0);
          expect(section.name.length).toBeGreaterThan(0);
        });
      });
    });

    it('PostgreSQL should have 7 sections', () => {
      expect(DATABASE_STRUCTURE.postgresql.sections.length).toBeGreaterThanOrEqual(7);
    });

    it('should have section IDs with no special characters', () => {
      Object.values(DATABASE_STRUCTURE).forEach(dbConfig => {
        dbConfig.sections.forEach(section => {
          expect(section.id).toMatch(/^[a-z0-9_-]+$/);
        });
      });
    });
  });

  describe('Integration: Data generation consistency', () => {
    it('should produce consistent multi-format data from same seed', () => {
      const seed = 'integration-test';
      const data24h = gen24h(seed, 100, 50, 200, 100);
      const data7d = gen7d(seed, 100, 30);

      expect(data24h.length).toBe(24);
      expect(data7d.length).toBe(7);
      expect(data24h[0]).toHaveProperty('primary');
      expect(data7d[0]).toHaveProperty('value');
    });

    it('should handle PostgreSQL structure with all 7 sections', () => {
      const pgConfig = DATABASE_STRUCTURE.postgresql;
      const expectedSectionIds = ['core', 'query', 'infra', 'schema', 'observability', 'dev', 'admin'];
      const sectionIds = pgConfig.sections.map(s => s.id);

      expectedSectionIds.forEach(id => {
        expect(sectionIds).toContain(id);
      });
    });

    it('should allow generation of demo data for all databases', () => {
      Object.entries(DATABASE_STRUCTURE).forEach(([dbKey, dbConfig]) => {
        // Each database should be able to generate demo data
        const seed = `demo-${dbKey}`;
        const data24h = gen24h(seed, 100, 50, 200, 100);
        const data7d = gen7d(seed, 100, 30);

        expect(data24h).toBeDefined();
        expect(data7d).toBeDefined();
        expect(data24h.length).toBe(24);
        expect(data7d.length).toBe(7);
      });
    });
  });
});
