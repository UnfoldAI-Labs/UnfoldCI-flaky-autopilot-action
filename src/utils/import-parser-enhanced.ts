import * as path from 'path';
import { ImportResolver } from './import-resolver';
import { detectLanguage, parseImports as parseImportsLegacy } from './import-parser';

/**
 * Enhanced import parser with alias resolution support
 * Falls back to legacy parser if resolver is not available
 */
export class EnhancedImportParser {
  private resolver: ImportResolver | null = null;

  constructor(projectRoot: string) {
    try {
      this.resolver = new ImportResolver(projectRoot);
    } catch (error) {
      console.warn(`⚠️  Failed to initialize enhanced import resolver: ${error}`);
      console.warn(`   Falling back to legacy import parser`);
    }
  }

  /**
   * Parse and resolve imports from code
   * Returns array of resolved file paths
   */
  parseImports(code: string, filePath: string): string[] {
    const language = detectLanguage(filePath);

    // Get raw import statements from code
    const rawImports = this.extractRawImports(code, language, filePath);

    if (!this.resolver) {
      // Fallback to legacy behavior
      return this.resolveImportsLegacy(rawImports, filePath, language);
    }

    // Use enhanced resolver
    return this.resolveImportsEnhanced(rawImports, filePath, language);
  }

  /**
   * Extract raw import strings from code (regex-based)
   */
  private extractRawImports(code: string, language: string, filePath: string): string[] {
    // Use existing regex-based parsers from legacy parser
    switch (language) {
      case 'javascript':
      case 'typescript':
        return this.extractJSImports(code);

      case 'python':
        return this.extractPythonImports(code);

      case 'java':
        return this.extractJavaImports(code);

      case 'go':
        return this.extractGoImports(code);

      case 'ruby':
        return this.extractRubyImports(code);

      case 'csharp':
        return this.extractCSharpImports(code);

      case 'php':
        return this.extractPHPImports(code);

      case 'rust':
        return this.extractRustImports(code);

      case 'kotlin':
        return this.extractKotlinImports(code);

      case 'swift':
        return this.extractSwiftImports(code);

      case 'c':
      case 'cpp':
        return this.extractCImports(code);

      default:
        return [];
    }
  }

  /**
   * Resolve imports using enhanced resolver (supports aliases)
   */
  private resolveImportsEnhanced(
    rawImports: string[],
    fromFile: string,
    language: string
  ): string[] {
    const resolved: string[] = [];

    for (const imp of rawImports) {
      try {
        const resolvedPath = this.resolver!.resolve(imp, fromFile, language);

        if (resolvedPath) {
          resolved.push(resolvedPath);
        }
      } catch (error) {
        // Graceful degradation - skip this import
        console.warn(`⚠️  Could not resolve import "${imp}" in ${fromFile}: ${error}`);
      }
    }

    return resolved;
  }

  /**
   * Resolve imports using legacy method (no alias support)
   */
  private resolveImportsLegacy(
    rawImports: string[],
    fromFile: string,
    language: string
  ): string[] {
    // Delegate to legacy parser for backwards compatibility
    return parseImportsLegacy('', fromFile);
  }

  // ==============================================
  // RAW IMPORT EXTRACTORS (regex-based)
  // ==============================================

  private extractJSImports(code: string): string[] {
    const imports: string[] = [];

    // ES6 imports: import X from './file'
    const esImportRegex = /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = esImportRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS: require('./path')
    const cjsImportRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = cjsImportRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractPythonImports(code: string): string[] {
    const imports: string[] = [];

    // from X import Y
    const fromRegex = /from\s+([.\w]+)\s+import/g;
    let match;
    while ((match = fromRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // import X
    const importRegex = /^import\s+([\w.]+)/gm;
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractJavaImports(code: string): string[] {
    const imports: string[] = [];

    // import com.example.Utils;
    const importRegex = /import\s+([\w.]+);/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const className = match[1];
      // Filter out java.* and javax.*
      if (!className.startsWith('java.') && !className.startsWith('javax.')) {
        imports.push(className);
      }
    }

    return imports;
  }

  private extractGoImports(code: string): string[] {
    const imports: string[] = [];

    // import "path"
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let match;
    while ((match = singleImportRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // import ( ... )
    const multiImportRegex = /import\s*\(\s*([\s\S]*?)\s*\)/g;
    while ((match = multiImportRegex.exec(code)) !== null) {
      const block = match[1];
      const pkgRegex = /"([^"]+)"/g;
      let pkgMatch;
      while ((pkgMatch = pkgRegex.exec(block)) !== null) {
        imports.push(pkgMatch[1]);
      }
    }

    return imports;
  }

  private extractRubyImports(code: string): string[] {
    const imports: string[] = [];

    // require './file' or require_relative './file'
    const requireRegex = /require(?:_relative)?\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = requireRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractCSharpImports(code: string): string[] {
    const imports: string[] = [];

    // using MyNamespace;
    const usingRegex = /using\s+([\w.]+);/g;
    let match;
    while ((match = usingRegex.exec(code)) !== null) {
      const ns = match[1];
      // Filter out System.*
      if (!ns.startsWith('System')) {
        imports.push(ns);
      }
    }

    return imports;
  }

  private extractPHPImports(code: string): string[] {
    const imports: string[] = [];

    // require './file.php'
    const requireRegex = /(?:require|include)(?:_once)?\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = requireRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // use My\Namespace\Class;
    const useRegex = /use\s+([\w\\]+);/g;
    while ((match = useRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractRustImports(code: string): string[] {
    const imports: string[] = [];

    // use crate::module;
    const useRegex = /use\s+crate::([\w:]+)/g;
    let match;
    while ((match = useRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractKotlinImports(code: string): string[] {
    const imports: string[] = [];

    // import com.example.Utils
    const importRegex = /import\s+([\w.]+)/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const pkg = match[1];
      // Filter out kotlin.*, java.*, android.*
      if (!pkg.startsWith('kotlin.') && !pkg.startsWith('java.') && !pkg.startsWith('android.')) {
        imports.push(pkg);
      }
    }

    return imports;
  }

  private extractSwiftImports(code: string): string[] {
    const imports: string[] = [];

    // import MyModule
    const importRegex = /import\s+([.\w]+)/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const module = match[1];
      // Filter out common frameworks
      if (!['Foundation', 'UIKit', 'SwiftUI', 'Combine'].includes(module)) {
        imports.push(module);
      }
    }

    return imports;
  }

  private extractCImports(code: string): string[] {
    const imports: string[] = [];

    // #include "local.h"
    const includeRegex = /#include\s+"([^"]+)"/g;
    let match;
    while ((match = includeRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }
}

/**
 * Convenience function for backwards compatibility
 */
export function parseImportsEnhanced(
  code: string,
  filePath: string,
  projectRoot: string
): string[] {
  const parser = new EnhancedImportParser(projectRoot);
  return parser.parseImports(code, filePath);
}
