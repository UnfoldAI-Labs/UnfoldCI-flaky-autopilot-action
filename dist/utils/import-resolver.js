"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportResolver = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_loader_1 = require("./config-loader");
class ImportResolver {
    constructor(projectRoot, customConfig) {
        this.cache = new Map();
        this.projectRoot = projectRoot;
        this.config = customConfig || config_loader_1.ConfigLoader.load(projectRoot);
        console.log(`📁 Import Resolver initialized`);
        if (Object.keys(this.config.aliases || {}).length > 0) {
            console.log(`   Aliases detected: ${Object.keys(this.config.aliases).length}`);
        }
        if (this.config.pythonPaths && this.config.pythonPaths.length > 1) {
            console.log(`   Python paths: ${this.config.pythonPaths.join(', ')}`);
        }
    }
    /**
     * Resolve an import path to an absolute file path
     * Returns null if the import is external (node_modules, etc.)
     */
    resolve(importPath, fromFile, language) {
        // Check cache first
        const cacheKey = `${fromFile}::${importPath}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        const resolved = this.doResolve(importPath, fromFile, language);
        this.cache.set(cacheKey, resolved);
        return resolved;
    }
    doResolve(importPath, fromFile, language) {
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
    resolveRelative(importPath, fromFile) {
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
    resolveAlias(importPath) {
        if (!this.config.aliases)
            return null;
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
    resolvePythonAbsolute(importPath, fromFile) {
        if (!this.config.pythonPaths)
            return null;
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
    generateCandidates(basePath) {
        const candidates = [];
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
    fileExists(filePath) {
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
        }
        catch {
            return false;
        }
    }
    /**
     * Clear the resolution cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.ImportResolver = ImportResolver;
