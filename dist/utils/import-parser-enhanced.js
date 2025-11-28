"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedImportParser = void 0;
exports.parseImportsEnhanced = parseImportsEnhanced;
const import_resolver_1 = require("./import-resolver");
const import_parser_1 = require("./import-parser");
/**
 * Enhanced import parser with alias resolution support
 * Falls back to legacy parser if resolver is not available
 */
class EnhancedImportParser {
    constructor(projectRoot) {
        this.resolver = null;
        try {
            this.resolver = new import_resolver_1.ImportResolver(projectRoot);
        }
        catch (error) {
            console.warn(`⚠️  Failed to initialize enhanced import resolver: ${error}`);
            console.warn(`   Falling back to legacy import parser`);
        }
    }
    /**
     * Parse and resolve imports from code
     * Returns array of resolved file paths
     */
    parseImports(code, filePath) {
        const language = (0, import_parser_1.detectLanguage)(filePath);
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
    extractRawImports(code, language, filePath) {
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
    resolveImportsEnhanced(rawImports, fromFile, language) {
        const resolved = [];
        for (const imp of rawImports) {
            try {
                const resolvedPath = this.resolver.resolve(imp, fromFile, language);
                if (resolvedPath) {
                    resolved.push(resolvedPath);
                }
            }
            catch (error) {
                // Graceful degradation - skip this import
                console.warn(`⚠️  Could not resolve import "${imp}" in ${fromFile}: ${error}`);
            }
        }
        return resolved;
    }
    /**
     * Resolve imports using legacy method (no alias support)
     */
    resolveImportsLegacy(rawImports, fromFile, language) {
        // Delegate to legacy parser for backwards compatibility
        return (0, import_parser_1.parseImports)('', fromFile);
    }
    // ==============================================
    // RAW IMPORT EXTRACTORS (regex-based)
    // ==============================================
    extractJSImports(code) {
        const imports = [];
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
    extractPythonImports(code) {
        const imports = [];
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
    extractJavaImports(code) {
        const imports = [];
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
    extractGoImports(code) {
        const imports = [];
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
    extractRubyImports(code) {
        const imports = [];
        // require './file' or require_relative './file'
        const requireRegex = /require(?:_relative)?\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = requireRegex.exec(code)) !== null) {
            imports.push(match[1]);
        }
        return imports;
    }
    extractCSharpImports(code) {
        const imports = [];
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
    extractPHPImports(code) {
        const imports = [];
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
    extractRustImports(code) {
        const imports = [];
        // use crate::module;
        const useRegex = /use\s+crate::([\w:]+)/g;
        let match;
        while ((match = useRegex.exec(code)) !== null) {
            imports.push(match[1]);
        }
        return imports;
    }
    extractKotlinImports(code) {
        const imports = [];
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
    extractSwiftImports(code) {
        const imports = [];
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
    extractCImports(code) {
        const imports = [];
        // #include "local.h"
        const includeRegex = /#include\s+"([^"]+)"/g;
        let match;
        while ((match = includeRegex.exec(code)) !== null) {
            imports.push(match[1]);
        }
        return imports;
    }
}
exports.EnhancedImportParser = EnhancedImportParser;
/**
 * Convenience function for backwards compatibility
 */
function parseImportsEnhanced(code, filePath, projectRoot) {
    const parser = new EnhancedImportParser(projectRoot);
    return parser.parseImports(code, filePath);
}
