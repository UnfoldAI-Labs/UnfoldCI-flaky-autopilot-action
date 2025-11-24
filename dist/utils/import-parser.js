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
exports.detectLanguage = detectLanguage;
exports.parseImports = parseImports;
const path = __importStar(require("path"));
function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.go': 'go',
        '.rb': 'ruby',
        '.cs': 'csharp',
        '.php': 'php',
        '.rs': 'rust',
        '.kt': 'kotlin',
        '.swift': 'swift',
    };
    return languageMap[ext] || 'unknown';
}
function parseImports(code, filePath) {
    const language = detectLanguage(filePath);
    switch (language) {
        case 'javascript':
        case 'typescript':
            return parseJSImports(code, filePath);
        case 'python':
            return parsePythonImports(code, filePath);
        case 'java':
            return parseJavaImports(code);
        case 'go':
            return parseGoImports(code);
        case 'ruby':
            return parseRubyImports(code);
        case 'csharp':
            return parseCSharpImports(code);
        case 'php':
            return parsePHPImports(code);
        case 'rust':
            return parseRustImports(code);
        case 'kotlin':
            return parseKotlinImports(code);
        case 'swift':
            return parseSwiftImports(code);
        default:
            console.warn(`⚠️  Language not supported for import parsing: ${language}`);
            return [];
    }
}
function parseJSImports(code, currentFilePath) {
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
    // Filter for local imports only (starts with . or /)
    return imports
        .filter(imp => imp.startsWith('.') || imp.startsWith('/'))
        .map(imp => resolveJSPath(imp, currentFilePath))
        .filter(Boolean);
}
function resolveJSPath(importPath, currentFilePath) {
    try {
        const currentDir = path.dirname(currentFilePath);
        let resolved = path.join(currentDir, importPath);
        resolved = resolved.replace(/\\/g, '/');
        // Add common extensions if missing
        if (!path.extname(resolved)) {
            // Return base path - will try .ts, .js, .tsx, .jsx extensions
            return resolved;
        }
        return resolved;
    }
    catch {
        return null;
    }
}
function parsePythonImports(code, currentFilePath) {
    const imports = [];
    // from X import Y
    const fromRegex = /from\s+([.\w]+)\s+import/g;
    let match;
    while ((match = fromRegex.exec(code)) !== null) {
        const module = match[1];
        if (!isPythonStdLib(module) && module.startsWith('.')) {
            imports.push(module);
        }
    }
    // import X
    const importRegex = /^import\s+([\w.]+)/gm;
    while ((match = importRegex.exec(code)) !== null) {
        const module = match[1];
        if (!isPythonStdLib(module)) {
            imports.push(module);
        }
    }
    return imports
        .filter(imp => imp.startsWith('.')) // Only relative imports
        .map(imp => pythonModuleToPath(imp, currentFilePath));
}
function pythonModuleToPath(module, currentFilePath) {
    if (module.startsWith('.')) {
        // Relative import: ..utils.helpers
        const levels = module.match(/^\.*/)[0].length;
        const rest = module.slice(levels);
        const currentDir = path.dirname(currentFilePath);
        const upDirs = '../'.repeat(levels - 1);
        const modulePath = rest.replace(/\./g, '/');
        return path.join(currentDir, upDirs, modulePath + '.py').replace(/\\/g, '/');
    }
    // Absolute import - convert to path
    return module.replace(/\./g, '/') + '.py';
}
function isPythonStdLib(module) {
    const stdLibs = [
        'os', 'sys', 'json', 'time', 're', 'math', 'random', 'datetime',
        'collections', 'itertools', 'functools', 'pathlib', 'typing',
        'unittest', 'pytest', 'asyncio', 'logging', 'csv', 'urllib'
    ];
    const baseName = module.split('.')[0];
    return stdLibs.includes(baseName);
}
function parseJavaImports(code) {
    const imports = [];
    // import com.example.Utils;
    const importRegex = /import\s+([\w.]+);/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
        const className = match[1];
        // Only local imports (not java.* or javax.*)
        if (!className.startsWith('java.') && !className.startsWith('javax.')) {
            // Convert package.ClassName to package/ClassName.java
            imports.push(className.replace(/\./g, '/') + '.java');
        }
    }
    return imports;
}
function parseGoImports(code) {
    const imports = [];
    // import "github.com/user/repo/package"
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let match;
    while ((match = singleImportRegex.exec(code)) !== null) {
        const pkg = match[1];
        if (pkg.startsWith('.')) {
            imports.push(pkg);
        }
    }
    // import ( "package1" "package2" )
    const multiImportRegex = /import\s*\(\s*([\s\S]*?)\s*\)/g;
    while ((match = multiImportRegex.exec(code)) !== null) {
        const block = match[1];
        const pkgRegex = /"([^"]+)"/g;
        let pkgMatch;
        while ((pkgMatch = pkgRegex.exec(block)) !== null) {
            const pkg = pkgMatch[1];
            if (pkg.startsWith('.')) {
                imports.push(pkg);
            }
        }
    }
    return imports;
}
function parseRubyImports(code) {
    const imports = [];
    // require './file' or require_relative './file'
    const requireRegex = /require(?:_relative)?\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = requireRegex.exec(code)) !== null) {
        const module = match[1];
        if (module.startsWith('.')) {
            imports.push(module + '.rb');
        }
    }
    return imports;
}
function parseCSharpImports(code) {
    const imports = [];
    // using MyNamespace.MyClass;
    const usingRegex = /using\s+([\w.]+);/g;
    let match;
    while ((match = usingRegex.exec(code)) !== null) {
        const ns = match[1];
        // Only local imports (not System.*)
        if (!ns.startsWith('System')) {
            imports.push(ns.replace(/\./g, '/') + '.cs');
        }
    }
    return imports;
}
function parsePHPImports(code) {
    const imports = [];
    // require './file.php' or include './file.php'
    const requireRegex = /(?:require|include)(?:_once)?\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = requireRegex.exec(code)) !== null) {
        const file = match[1];
        if (file.startsWith('.')) {
            imports.push(file);
        }
    }
    // use My\Namespace\Class;
    const useRegex = /use\s+([\w\\]+);/g;
    while ((match = useRegex.exec(code)) !== null) {
        const ns = match[1];
        imports.push(ns.replace(/\\/g, '/') + '.php');
    }
    return imports;
}
function parseRustImports(code) {
    const imports = [];
    // use crate::module::submodule;
    const useRegex = /use\s+crate::([\w:]+)/g;
    let match;
    while ((match = useRegex.exec(code)) !== null) {
        const module = match[1];
        imports.push('src/' + module.replace(/::/g, '/') + '.rs');
    }
    // mod module_name; (references module_name.rs)
    const modRegex = /mod\s+(\w+);/g;
    while ((match = modRegex.exec(code)) !== null) {
        imports.push(match[1] + '.rs');
    }
    return imports;
}
function parseKotlinImports(code) {
    const imports = [];
    // import com.example.Utils
    const importRegex = /import\s+([\w.]+)/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
        const pkg = match[1];
        // Only local imports (not kotlin.* or java.*)
        if (!pkg.startsWith('kotlin.') && !pkg.startsWith('java.')) {
            imports.push(pkg.replace(/\./g, '/') + '.kt');
        }
    }
    return imports;
}
function parseSwiftImports(code) {
    const imports = [];
    // import MyModule
    const importRegex = /import\s+(\w+)/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
        const module = match[1];
        // Only local imports (not Foundation, UIKit, etc.)
        const systemModules = ['Foundation', 'UIKit', 'SwiftUI', 'Combine'];
        if (!systemModules.includes(module)) {
            imports.push(module + '.swift');
        }
    }
    return imports;
}
