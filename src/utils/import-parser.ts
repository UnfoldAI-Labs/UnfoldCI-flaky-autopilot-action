import * as path from 'path';

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const languageMap: Record<string, string> = {
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

export function parseImports(code: string, filePath: string): string[] {
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

function parseJSImports(code: string, currentFilePath: string): string[] {
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

  // Filter for local imports only (starts with . or /)
  return imports
    .filter(imp => imp.startsWith('.') || imp.startsWith('/'))
    .map(imp => resolveJSPath(imp, currentFilePath))
    .filter(Boolean) as string[];
}

function resolveJSPath(importPath: string, currentFilePath: string): string | null {
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
  } catch {
    return null;
  }
}

function parsePythonImports(code: string, currentFilePath: string): string[] {
  const imports: string[] = [];

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

function pythonModuleToPath(module: string, currentFilePath: string): string {
  if (module.startsWith('.')) {
    // Relative import: ..utils.helpers
    const levels = module.match(/^\.*/)![0].length;
    const rest = module.slice(levels);
    const currentDir = path.dirname(currentFilePath);
    const upDirs = '../'.repeat(levels - 1);
    const modulePath = rest.replace(/\./g, '/');
    return path.join(currentDir, upDirs, modulePath + '.py').replace(/\\/g, '/');
  }

  // Absolute import - convert to path
  return module.replace(/\./g, '/') + '.py';
}

function isPythonStdLib(module: string): boolean {
  const stdLibs = [
    'os', 'sys', 'json', 'time', 're', 'math', 'random', 'datetime',
    'collections', 'itertools', 'functools', 'pathlib', 'typing',
    'unittest', 'pytest', 'asyncio', 'logging', 'csv', 'urllib'
  ];
  const baseName = module.split('.')[0];
  return stdLibs.includes(baseName);
}

function parseJavaImports(code: string): string[] {
  const imports: string[] = [];

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

function parseGoImports(code: string): string[] {
  const imports: string[] = [];

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

function parseRubyImports(code: string): string[] {
  const imports: string[] = [];

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

function parseCSharpImports(code: string): string[] {
  const imports: string[] = [];

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

function parsePHPImports(code: string): string[] {
  const imports: string[] = [];

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

function parseRustImports(code: string): string[] {
  const imports: string[] = [];

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

function parseKotlinImports(code: string): string[] {
  const imports: string[] = [];

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

function parseSwiftImports(code: string): string[] {
  const imports: string[] = [];

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

function parseCImports(code: string, currentFilePath: string): string[] {
  const imports: string[] = [];

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
