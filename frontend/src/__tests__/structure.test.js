/**
 * Structure Test Suite
 * Tests project structure, file existence, and dependency availability
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

describe('Project Structure', () => {
  describe('Core files exist', () => {
    it('should have App.jsx', () => {
      const filePath = resolve(projectRoot, 'src/App.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have main.jsx', () => {
      const filePath = resolve(projectRoot, 'src/main.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have vite.config.js', () => {
      const filePath = resolve(projectRoot, 'vite.config.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have package.json', () => {
      const filePath = resolve(projectRoot, 'package.json');
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('Configuration files exist', () => {
    it('should have tabConfig.js', () => {
      const filePath = resolve(projectRoot, 'src/config/tabConfig.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have designTokens.js', () => {
      const filePath = resolve(projectRoot, 'src/config/designTokens.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have demoData.js', () => {
      const filePath = resolve(projectRoot, 'src/utils/demoData.js');
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('Component directories exist', () => {
    it('should have views directory', () => {
      const dirPath = resolve(projectRoot, 'src/components/views');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have analytics components', () => {
      const dirPath = resolve(projectRoot, 'src/components/views/analytics');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have monitoring components', () => {
      const dirPath = resolve(projectRoot, 'src/components/views/monitoring');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have database components', () => {
      const dirPath = resolve(projectRoot, 'src/components/views/database');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have admin components', () => {
      const dirPath = resolve(projectRoot, 'src/components/views/admin');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have security components', () => {
      const dirPath = resolve(projectRoot, 'src/components/views/security');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have operations components', () => {
      const dirPath = resolve(projectRoot, 'src/components/views/operations');
      expect(existsSync(dirPath)).toBe(true);
    });
  });

  describe('Test files exist', () => {
    it('should have tabConfig tests', () => {
      const filePath = resolve(projectRoot, 'src/config/__tests__/tabConfig.test.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have designTokens tests', () => {
      const filePath = resolve(projectRoot, 'src/config/__tests__/designTokens.test.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have demoData tests', () => {
      const filePath = resolve(projectRoot, 'src/utils/__tests__/demoData.test.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have DemoDataTab tests', () => {
      const filePath = resolve(projectRoot, 'src/components/__tests__/DemoDataTab.test.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have integration tests', () => {
      const filePath = resolve(projectRoot, 'src/__tests__/integration.test.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have performance tests', () => {
      const filePath = resolve(projectRoot, 'src/__tests__/performance.test.js');
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('package.json validity', () => {
    it('should have valid JSON', () => {
      const pkgPath = resolve(projectRoot, 'package.json');
      const content = readFileSync(pkgPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should have test script', () => {
      const pkgPath = resolve(projectRoot, 'package.json');
      const content = readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts).toHaveProperty('test');
    });

    it('should have vitest in scripts', () => {
      const pkgPath = resolve(projectRoot, 'package.json');
      const content = readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts.test).toContain('vitest');
    });

    it('should have required dependencies', () => {
      const pkgPath = resolve(projectRoot, 'package.json');
      const content = readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);

      const requiredDeps = [
        'react',
        'react-dom',
        'react-router-dom',
        'recharts',
        'lucide-react',
      ];

      requiredDeps.forEach(dep => {
        expect(pkg.dependencies).toHaveProperty(dep);
      });
    });
  });

  describe('vite.config.js validity', () => {
    it('should have valid JavaScript', () => {
      const configPath = resolve(projectRoot, 'vite.config.js');
      const content = readFileSync(configPath, 'utf-8');
      expect(() => {
        // Just check it doesn't have obvious syntax errors
        expect(content).toContain('defineConfig');
      }).not.toThrow();
    });

    it('should include test configuration', () => {
      const configPath = resolve(projectRoot, 'vite.config.js');
      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('test:');
    });

    it('should configure vitest environment', () => {
      const configPath = resolve(projectRoot, 'vite.config.js');
      const content = readFileSync(configPath, 'utf-8');
      expect(content).toContain('environment');
    });
  });

  describe('Context files exist', () => {
    it('should have AuthContext', () => {
      const filePath = resolve(projectRoot, 'src/context/AuthContext.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have ThemeContext', () => {
      const filePath = resolve(projectRoot, 'src/context/ThemeContext.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have ConnectionContext', () => {
      const filePath = resolve(projectRoot, 'src/context/ConnectionContext.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have DemoContext', () => {
      const filePath = resolve(projectRoot, 'src/context/DemoContext.jsx');
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('Utility files exist', () => {
    it('should have api.js', () => {
      const filePath = resolve(projectRoot, 'src/utils/api.js');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have theme.jsx', () => {
      const filePath = resolve(projectRoot, 'src/utils/theme.jsx');
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('Enterprise features exist', () => {
    it('should have enterprise directory', () => {
      const dirPath = resolve(projectRoot, 'src/enterprise');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have enterprise context', () => {
      const dirPath = resolve(projectRoot, 'src/enterprise/context');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have enterprise components', () => {
      const dirPath = resolve(projectRoot, 'src/enterprise/components');
      expect(existsSync(dirPath)).toBe(true);
    });
  });

  describe('Demo components exist', () => {
    it('should have DemoDataTab.jsx', () => {
      const filePath = resolve(projectRoot, 'src/components/views/analytics/DemoDataTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have DemoPostgresTab.jsx', () => {
      const filePath = resolve(projectRoot, 'src/components/views/analytics/DemoPostgresTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have DemoMySQLTab.jsx', () => {
      const filePath = resolve(projectRoot, 'src/components/views/analytics/DemoMySQLTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have DemoMongoDBTab.jsx', () => {
      const filePath = resolve(projectRoot, 'src/components/views/analytics/DemoMongoDBTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('Tab component files exist', () => {
    it('should have OverviewTab', () => {
      const filePath = resolve(projectRoot, 'src/components/views/monitoring/OverviewTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have PerformanceTab', () => {
      const filePath = resolve(projectRoot, 'src/components/views/monitoring/PerformanceTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have ResourcesTab', () => {
      const filePath = resolve(projectRoot, 'src/components/views/monitoring/ResourcesTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have IndexesTab', () => {
      const filePath = resolve(projectRoot, 'src/components/views/database/IndexesTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have SqlConsoleTab', () => {
      const filePath = resolve(projectRoot, 'src/components/views/database/SqlConsoleTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have BackupRecoveryTab', () => {
      const filePath = resolve(projectRoot, 'src/components/views/operations/BackupRecoveryTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have AdminTab', () => {
      const filePath = resolve(projectRoot, 'src/components/views/admin/AdminTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should have SecurityComplianceTab', () => {
      const filePath = resolve(projectRoot, 'src/components/views/security/SecurityComplianceTab.jsx');
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('Directory structure completeness', () => {
    it('should have public directory for static assets', () => {
      const dirPath = resolve(projectRoot, 'public');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have src/components directory', () => {
      const dirPath = resolve(projectRoot, 'src/components');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have src/context directory', () => {
      const dirPath = resolve(projectRoot, 'src/context');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have src/utils directory', () => {
      const dirPath = resolve(projectRoot, 'src/utils');
      expect(existsSync(dirPath)).toBe(true);
    });

    it('should have src/config directory', () => {
      const dirPath = resolve(projectRoot, 'src/config');
      expect(existsSync(dirPath)).toBe(true);
    });
  });
});
