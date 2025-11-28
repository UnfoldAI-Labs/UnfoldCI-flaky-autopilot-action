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
exports.ConfigLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ConfigLoader {
    /**
     * Load import resolution configuration from project
     * Priority: .flaky-autopilot.json > tsconfig.json > inferred
     */
    static load(projectRoot) {
        // Try explicit config first
        const explicitConfig = this.loadExplicitConfig(projectRoot);
        if (explicitConfig) {
            return explicitConfig;
        }
        // Fallback to inferring from standard config files
        return this.inferConfig(projectRoot);
    }
    /**
     * Load explicit .flaky-autopilot.json config
     */
    static loadExplicitConfig(projectRoot) {
        const configPath = path.join(projectRoot, '.flaky-autopilot.json');
        if (!fs.existsSync(configPath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(content);
            // Validate and extract importResolver section
            if (parsed.importResolver) {
                return this.normalizeConfig(parsed.importResolver, projectRoot);
            }
            return null;
        }
        catch (error) {
            console.warn(`⚠️  Failed to parse .flaky-autopilot.json: ${error}`);
            return null;
        }
    }
    /**
     * Infer configuration from standard project config files
     */
    static inferConfig(projectRoot) {
        const config = {
            aliases: {},
            pythonPaths: ['.'],
            extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.mjs'],
            moduleDirectories: ['node_modules']
        };
        // Try to load TypeScript config
        const tsConfig = this.loadTsConfig(projectRoot);
        if (tsConfig) {
            config.aliases = { ...config.aliases, ...this.extractTsConfigAliases(tsConfig, projectRoot) };
            if (tsConfig.baseUrl) {
                config.baseUrl = tsConfig.baseUrl;
            }
        }
        // Try to load jsconfig.json (for JavaScript projects)
        if (!tsConfig) {
            const jsConfig = this.loadJsConfig(projectRoot);
            if (jsConfig) {
                config.aliases = { ...config.aliases, ...this.extractTsConfigAliases(jsConfig, projectRoot) };
                if (jsConfig.baseUrl) {
                    config.baseUrl = jsConfig.baseUrl;
                }
            }
        }
        // Try to load Python paths
        const pythonPaths = this.loadPythonPaths(projectRoot);
        if (pythonPaths.length > 0) {
            config.pythonPaths = pythonPaths;
        }
        return config;
    }
    /**
     * Load tsconfig.json
     */
    static loadTsConfig(projectRoot) {
        const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
        if (!fs.existsSync(tsConfigPath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(tsConfigPath, 'utf-8');
            // Remove comments (simple approach - not perfect but works for most cases)
            const cleaned = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
            const parsed = JSON.parse(cleaned);
            return {
                baseUrl: parsed.compilerOptions?.baseUrl,
                paths: parsed.compilerOptions?.paths
            };
        }
        catch (error) {
            console.warn(`⚠️  Failed to parse tsconfig.json: ${error}`);
            return null;
        }
    }
    /**
     * Load jsconfig.json (same format as tsconfig)
     */
    static loadJsConfig(projectRoot) {
        const jsConfigPath = path.join(projectRoot, 'jsconfig.json');
        if (!fs.existsSync(jsConfigPath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(jsConfigPath, 'utf-8');
            const cleaned = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
            const parsed = JSON.parse(cleaned);
            return {
                baseUrl: parsed.compilerOptions?.baseUrl,
                paths: parsed.compilerOptions?.paths
            };
        }
        catch (error) {
            console.warn(`⚠️  Failed to parse jsconfig.json: ${error}`);
            return null;
        }
    }
    /**
     * Extract aliases from TypeScript/JavaScript paths config
     */
    static extractTsConfigAliases(tsConfig, projectRoot) {
        const aliases = {};
        if (!tsConfig.paths) {
            return aliases;
        }
        const baseUrl = tsConfig.baseUrl || '.';
        const baseUrlAbs = path.join(projectRoot, baseUrl);
        for (const [alias, targets] of Object.entries(tsConfig.paths)) {
            // Convert TypeScript path pattern to simple alias
            // "@/*" -> "@" with target "./src/*" -> "./src"
            const cleanAlias = alias.replace(/\/\*$/, '');
            const cleanTarget = targets[0]?.replace(/\/\*$/, '') || '';
            const targetPath = path.join(baseUrlAbs, cleanTarget);
            const relativePath = path.relative(projectRoot, targetPath);
            aliases[cleanAlias] = './' + relativePath.replace(/\\/g, '/');
        }
        return aliases;
    }
    /**
     * Load Python paths from pytest.ini, setup.cfg, or pyproject.toml
     */
    static loadPythonPaths(projectRoot) {
        // Try pytest.ini
        const pytestIni = path.join(projectRoot, 'pytest.ini');
        if (fs.existsSync(pytestIni)) {
            const paths = this.parsePytestIni(pytestIni);
            if (paths.length > 0)
                return paths;
        }
        // Try setup.cfg
        const setupCfg = path.join(projectRoot, 'setup.cfg');
        if (fs.existsSync(setupCfg)) {
            const paths = this.parseSetupCfg(setupCfg);
            if (paths.length > 0)
                return paths;
        }
        // Try pyproject.toml
        const pyprojectToml = path.join(projectRoot, 'pyproject.toml');
        if (fs.existsSync(pyprojectToml)) {
            const paths = this.parsePyprojectToml(pyprojectToml);
            if (paths.length > 0)
                return paths;
        }
        // Default: current directory
        return ['.'];
    }
    static parsePytestIni(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const match = content.match(/pythonpath\s*=\s*(.+)/);
            if (match) {
                return match[1].trim().split(/\s+/);
            }
        }
        catch (error) {
            console.warn(`⚠️  Failed to parse pytest.ini: ${error}`);
        }
        return [];
    }
    static parseSetupCfg(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            // Look for [tool:pytest] or [pytest] section
            const pytestSection = content.match(/\[(tool:)?pytest\]([\s\S]*?)(\[|$)/);
            if (pytestSection) {
                const section = pytestSection[2];
                const match = section.match(/pythonpath\s*=\s*(.+)/);
                if (match) {
                    return match[1].trim().split(/\s+/);
                }
            }
        }
        catch (error) {
            console.warn(`⚠️  Failed to parse setup.cfg: ${error}`);
        }
        return [];
    }
    static parsePyprojectToml(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            // Simple TOML parsing for pythonpath
            // [tool.pytest.ini_options]
            // pythonpath = ["."]
            const match = content.match(/\[tool\.pytest\.ini_options\]([\s\S]*?)(\[|$)/);
            if (match) {
                const section = match[1];
                const pathMatch = section.match(/pythonpath\s*=\s*\[(.*?)\]/);
                if (pathMatch) {
                    const paths = pathMatch[1]
                        .split(',')
                        .map(p => p.trim().replace(/['"]/g, ''))
                        .filter(p => p.length > 0);
                    return paths;
                }
            }
        }
        catch (error) {
            console.warn(`⚠️  Failed to parse pyproject.toml: ${error}`);
        }
        return [];
    }
    /**
     * Normalize config paths to be absolute
     */
    static normalizeConfig(config, projectRoot) {
        const normalized = {
            aliases: {},
            pythonPaths: config.pythonPaths || ['.'],
            extensions: config.extensions || ['.js', '.ts', '.jsx', '.tsx'],
            moduleDirectories: config.moduleDirectories || ['node_modules']
        };
        // Normalize aliases to absolute paths
        if (config.aliases) {
            for (const [alias, target] of Object.entries(config.aliases)) {
                if (typeof target === 'string') {
                    normalized.aliases[alias] = target;
                }
            }
        }
        if (config.baseUrl) {
            normalized.baseUrl = config.baseUrl;
        }
        return normalized;
    }
}
exports.ConfigLoader = ConfigLoader;
