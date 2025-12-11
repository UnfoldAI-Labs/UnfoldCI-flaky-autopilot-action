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
        '.c': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.hh': 'cpp',
        '.hxx': 'cpp',
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
        case 'c':
        case 'cpp':
            return parseCImports(code, filePath);
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
        if (!isPythonStdLib(module) && !isPythonExternalPackage(module)) {
            imports.push(module);
        }
    }
    // import X
    const importRegex = /^import\s+([\w.]+)/gm;
    while ((match = importRegex.exec(code)) !== null) {
        const module = match[1];
        if (!isPythonStdLib(module) && !isPythonExternalPackage(module)) {
            imports.push(module);
        }
    }
    return imports.map(imp => pythonModuleToPath(imp, currentFilePath));
}
function pythonModuleToPath(module, currentFilePath) {
    if (module.startsWith('.')) {
        // Relative import: ..utils.helpers or .foo
        const levels = module.match(/^\.*/)[0].length;
        const rest = module.slice(levels);
        const currentDir = path.dirname(currentFilePath);
        const upDirs = '../'.repeat(levels - 1);
        const modulePath = rest ? rest.replace(/\./g, '/') : '';
        const result = path.join(currentDir, upDirs, modulePath + '.py').replace(/\\/g, '/');
        return result;
    }
    // Absolute import (e.g., src.core.base, tests.helpers, app.main)
    // These are local project imports - convert to path
    // e.g., "src.core.base" → "src/core/base.py"
    return module.replace(/\./g, '/') + '.py';
}
function isPythonStdLib(module) {
    const stdLibs = [
        'os', 'sys', 'json', 'time', 're', 'math', 'random', 'datetime',
        'collections', 'itertools', 'functools', 'pathlib', 'typing',
        'unittest', 'pytest', 'asyncio', 'logging', 'csv', 'urllib',
        'io', 'string', 'struct', 'copy', 'pprint', 'enum', 'abc',
        'contextlib', 'dataclasses', 'hashlib', 'hmac', 'secrets',
        'threading', 'multiprocessing', 'subprocess', 'socket', 'ssl',
        'http', 'email', 'html', 'xml', 'base64', 'binascii', 'pickle',
        'sqlite3', 'zlib', 'gzip', 'bz2', 'lzma', 'zipfile', 'tarfile',
        'tempfile', 'shutil', 'glob', 'fnmatch', 'linecache', 'traceback',
        'warnings', 'inspect', 'dis', 'types', 'weakref', 'gc', 'atexit',
        'argparse', 'getopt', 'configparser', 'fileinput', 'stat', 'platform',
        'errno', 'ctypes', 'concurrent', 'queue', 'heapq', 'bisect', 'array',
        'decimal', 'fractions', 'numbers', 'cmath', 'statistics', 'operator',
        'textwrap', 'unicodedata', 'codecs', 'locale', 'gettext', 'calendar',
        'uuid', 'ipaddress', 'select', 'selectors', 'signal', 'mmap', 'cProfile',
        'pstats', 'timeit', 'trace', 'builtins', '__future__', 'keyword', 'token',
        'tokenize', 'ast', 'symtable', 'compileall', 'pyclbr', 'py_compile',
        'importlib', 'pkgutil', 'runpy', 'sysconfig', 'site', 'venv',
        'doctest', 'pdb', 'faulthandler', 'unittest', 'mock', 'test'
    ];
    const baseName = module.split('.')[0];
    return stdLibs.includes(baseName);
}
function isPythonExternalPackage(module) {
    // Common external packages that should be ignored
    const externalPackages = [
        // Testing
        'pytest', 'nose', 'hypothesis', 'mock', 'faker', 'factory_boy',
        // Web frameworks
        'flask', 'django', 'fastapi', 'starlette', 'tornado', 'bottle', 'pyramid',
        'aiohttp', 'sanic', 'quart', 'uvicorn', 'gunicorn', 'werkzeug',
        // Data science
        'numpy', 'pandas', 'scipy', 'matplotlib', 'seaborn', 'plotly',
        'sklearn', 'tensorflow', 'torch', 'keras', 'xgboost', 'lightgbm',
        // Database
        'sqlalchemy', 'psycopg2', 'pymongo', 'redis', 'elasticsearch',
        'motor', 'asyncpg', 'aiomysql', 'peewee', 'tortoise',
        // HTTP/API
        'requests', 'httpx', 'aiohttp', 'urllib3', 'httplib2', 'pycurl',
        // AWS/Cloud
        'boto3', 'botocore', 'azure', 'google', 'aws_cdk',
        // Utilities
        'pydantic', 'marshmallow', 'attrs', 'dataclasses_json', 'orjson',
        'click', 'typer', 'rich', 'tqdm', 'colorama', 'termcolor',
        'yaml', 'toml', 'dotenv', 'environs', 'decouple',
        'celery', 'rq', 'dramatiq', 'huey',
        'jwt', 'passlib', 'bcrypt', 'cryptography', 'paramiko',
        'lxml', 'beautifulsoup4', 'bs4', 'scrapy', 'selenium',
        'pillow', 'PIL', 'cv2', 'opencv',
        'grpc', 'grpcio', 'protobuf', 'thrift',
        'graphql', 'strawberry', 'ariadne',
        'alembic', 'migrate',
        'loguru', 'structlog',
        'tenacity', 'backoff', 'retrying',
        'freezegun', 'responses', 'httpretty', 'vcrpy',
        'mypy', 'black', 'flake8', 'pylint', 'isort', 'autopep8',
        'setuptools', 'wheel', 'pip', 'poetry', 'pipenv',
    ];
    const baseName = module.split('.')[0];
    return externalPackages.includes(baseName);
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
function parseCImports(code, currentFilePath) {
    const imports = [];
    // #include "local_file.h" or #include "local_file.hpp"
    const localIncludeRegex = /#include\s+"([^"]+)"/g;
    let match;
    while ((match = localIncludeRegex.exec(code)) !== null) {
        const includePath = match[1];
        // Only local includes (with quotes, not angle brackets)
        const currentDir = path.dirname(currentFilePath);
        let resolved = path.join(currentDir, includePath);
        resolved = resolved.replace(/\\/g, '/');
        imports.push(resolved);
    }
    return imports;
}
