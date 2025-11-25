import * as fs from 'fs';
import * as path from 'path';
import { ConfigLoader, ResolverConfig } from './config-loader';

export class ImportResolver {
  private config: ResolverConfig;
  private projectRoot: string;
  private cache = new Map<string, string | null>();

  constructor(projectRoot: string, customConfig?: ResolverConfig) {
    this.projectRoot = projectRoot;
    this.config = customConfig || ConfigLoader.load(projectRoot);

    console.log(`📁 Import Resolver initialized`);
    if (Object.keys(this.config.aliases || {}).length > 0) {
      console.log(`   Aliases detected: ${Object.keys(this.config.aliases!).length}`);
    }
    if (this.config.pythonPaths && this.config.pythonPaths.length > 1) {
      console.log(`   Python paths: ${this.config.pythonPaths.join(', ')}`);
    }
  }

  /**
   * Resolve an import path to an absolute file path
   * Returns null if the import is external (node_modules, etc.)
   */
  resolve(importPath: string, fromFile: string, language: string): string | null {
    // Check cache first
    const cacheKey = `${fromFile}::${importPath}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const resolved = this.doResolve(importPath, fromFile, language);
    this.cache.set(cacheKey, resolved);
    return resolved;
  }

  private doResolve(importPath: string, fromFile: string, language: string): string | null {
    // 1. Relative imports (./file or ../file) - highest priority
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      return this.resolveRelative(importPath, fromFile);
    }

    // 2. Try configured aliases (@/, ~/, etc.)
    if (this.config.aliases && Object.keys(this.config.aliases).length > 0) {
      const aliasResolved = this.resolveAlias(importPath);
      if (aliasResolved) {
        return aliasResolved;
      }
    }

    // 3. Python absolute imports (if Python file)
    if (language === 'python' && this.config.pythonPaths) {
      const pythonResolved = this.resolvePythonAbsolute(importPath, fromFile);
      if (pythonResolved) {
        return pythonResolved;
      }
    }

    // 4. External package - return null (intentionally not tracked)
    return null;
  }

  /**
   * Resolve relative import (./file or ../file)
   */
  private resolveRelative(importPath: string, fromFile: string): string | null {
    const fromDir = path.dirname(fromFile);
    let resolved = path.join(fromDir, importPath);
    resolved = resolved.replace(/\\/g, '/');

    // Try with various extensions
    const candidates = this.generateCandidates(resolved);

    for (const candidate of candidates) {
      if (this.fileExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Resolve alias-based import (@/file, ~/file, etc.)
   */
  private resolveAlias(importPath: string): string | null {
    if (!this.config.aliases) return null;

    // Try each alias from longest to shortest (more specific first)
    const sortedAliases = Object.entries(this.config.aliases)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [alias, target] of sortedAliases) {
      // Check if import starts with this alias
      if (importPath === alias || importPath.startsWith(alias + '/')) {
        // Replace alias with target path
        const rest = importPath.slice(alias.length);
        let resolved = path.join(this.projectRoot, target, rest);
        resolved = resolved.replace(/\\/g, '/');

        // Try with various extensions
        const candidates = this.generateCandidates(resolved);

        for (const candidate of candidates) {
          if (this.fileExists(candidate)) {
            return candidate;
          }
        }
      }
    }

    return null;
  }

  /**
   * Resolve Python absolute import (from helpers import X)
   */
  private resolvePythonAbsolute(importPath: string, fromFile: string): string | null {
    if (!this.config.pythonPaths) return null;

    // Convert module path to file path: helpers.utils → helpers/utils.py
    const modulePath = importPath.replace(/\./g, '/');

    // Try each Python path
    for (const basePath of this.config.pythonPaths) {
      const basePathAbs = path.join(this.projectRoot, basePath);

      const candidates = [
        // Direct module file: helpers/utils.py
        path.join(basePathAbs, modulePath + '.py'),

        // Package __init__: helpers/__init__.py
        path.join(basePathAbs, modulePath, '__init__.py'),

        // First component as package: helpers/__init__.py (for "from helpers import X")
        path.join(basePathAbs, importPath.split('.')[0], '__init__.py'),

        // Try relative to the test file directory
        path.join(path.dirname(fromFile), modulePath + '.py'),

        // Try relative to test file as package
        path.join(path.dirname(fromFile), modulePath, '__init__.py')
      ];

      for (const candidate of candidates) {
        if (this.fileExists(candidate)) {
          return candidate.replace(/\\/g, '/');
        }
      }
    }

    return null;
  }

  /**
   * Generate candidate file paths with different extensions
   */
  private generateCandidates(basePath: string): string[] {
    const candidates: string[] = [];

    // If already has extension, try it first
    if (path.extname(basePath)) {
      candidates.push(basePath);
      return candidates;
    }

    // Try with configured extensions
    const extensions = this.config.extensions || ['.js', '.ts', '.jsx', '.tsx', '.py'];

    for (const ext of extensions) {
      candidates.push(basePath + ext);
    }

    // Try index files
    for (const ext of extensions) {
      candidates.push(path.join(basePath, 'index' + ext));
    }

    return candidates;
  }

  /**
   * Check if file exists (with fallback for case-insensitive systems)
   */
  private fileExists(filePath: string): boolean {
    try {
      // Direct check
      if (fs.existsSync(filePath)) {
        return true;
      }

      // Try case-insensitive match (for Windows/macOS)
      const dir = path.dirname(filePath);
      const basename = path.basename(filePath);

      if (!fs.existsSync(dir)) {
        return false;
      }

      const files = fs.readdirSync(dir);
      const match = files.find(f => f.toLowerCase() === basename.toLowerCase());

      return !!match;
    } catch {
      return false;
    }
  }

  /**
   * Clear the resolution cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get current configuration
   */
  getConfig(): ResolverConfig {
    return { ...this.config };
  }
}
