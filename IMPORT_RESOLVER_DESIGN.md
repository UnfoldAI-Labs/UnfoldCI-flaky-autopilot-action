# Enhanced Import Resolution Design

## Problem Statement

Current limitations preventing universal import support:

1. **Python absolute imports** - `from helpers import X` not detected
2. **Build tool aliases** - `@/`, `~/`, `#/` not resolved
3. **Webpack/Vite aliases** - Custom path mappings
4. **TypeScript path mappings** - `paths` in tsconfig.json
5. **Dynamic imports** - Variable-based import paths
6. **Monorepo imports** - Package references in monorepos

## Solution Architecture

### Phase 1: Configuration File Support

Add support for project configuration files that define import resolution rules.

#### 1.1 Auto-detect Configuration Files

The action should automatically look for and parse:

```
Priority order:
1. .flaky-autopilot.json (custom config)
2. tsconfig.json (TypeScript projects)
3. jsconfig.json (JavaScript projects)
4. webpack.config.js
5. vite.config.js
6. package.json (check for aliases)
7. pytest.ini / setup.cfg (Python)
8. pyproject.toml (Python)
```

#### 1.2 Flaky Autopilot Config Format

**`.flaky-autopilot.json`:**
```json
{
  "importResolver": {
    "aliases": {
      "@": "./src",
      "~": "./",
      "#": "./src/components",
      "@utils": "./src/utils",
      "@components": "./src/components"
    },
    "pythonPaths": [
      ".",
      "./src",
      "./tests"
    ],
    "extensions": [".js", ".ts", ".jsx", ".tsx", ".vue"],
    "moduleDirectories": ["node_modules", "src"],
    "baseUrl": "./src"
  }
}
```

### Phase 2: TypeScript Path Resolution

#### 2.1 Read tsconfig.json

Parse `compilerOptions.paths`:

```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@utils/*": ["utils/*"],
      "@components/*": ["components/*"],
      "~/*": ["../*"]
    }
  }
}
```

#### 2.2 Resolution Algorithm

```typescript
function resolveTsConfigPath(importPath: string, tsConfig: TsConfig): string | null {
  const { baseUrl, paths } = tsConfig.compilerOptions;

  // Try each path mapping
  for (const [pattern, mappings] of Object.entries(paths)) {
    const regex = new RegExp('^' + pattern.replace('*', '(.*)'));
    const match = importPath.match(regex);

    if (match) {
      for (const mapping of mappings) {
        const resolved = mapping.replace('*', match[1] || '');
        const fullPath = path.join(baseUrl, resolved);
        return fullPath;
      }
    }
  }

  return null;
}
```

### Phase 3: Python Absolute Import Resolution

#### 3.1 Detect Python Source Roots

Look for:
- `pytest.ini` → `pythonpath` setting
- `setup.py` → project structure
- `pyproject.toml` → `[tool.pytest.ini_options]`
- `.flaky-autopilot.json` → `pythonPaths`

#### 3.2 Python Import Resolution

```typescript
function resolvePythonAbsoluteImport(
  importPath: string,
  testFile: string,
  pythonPaths: string[]
): string | null {
  // Convert: from helpers import X → helpers.py
  const modulePath = importPath.replace(/\./g, '/') + '.py';

  // Try each Python path
  for (const basePath of pythonPaths) {
    const candidates = [
      path.join(basePath, modulePath),
      path.join(basePath, importPath.split('.')[0], '__init__.py'),
      // Try relative to test file
      path.join(path.dirname(testFile), modulePath)
    ];

    for (const candidate of candidates) {
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}
```

#### 3.3 Enhanced pytest.ini Support

```ini
[pytest]
pythonpath = . src tests
testpaths = tests
```

Parse and use `pythonpath` for import resolution.

### Phase 4: Webpack/Vite Alias Resolution

#### 4.1 Parse Webpack Config

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
      '~': path.resolve(__dirname, './'),
      'components': path.resolve(__dirname, 'src/components/')
    }
  }
}
```

#### 4.2 Parse Vite Config

```javascript
// vite.config.js
export default {
  resolve: {
    alias: {
      '@': '/src',
      '~': '/',
      '#': '/src/components'
    }
  }
}
```

#### 4.3 Config Parser

```typescript
async function parseWebpackConfig(configPath: string): Promise<AliasConfig> {
  // Use vm or eval in sandbox to execute config
  // Extract resolve.alias
  const config = await import(configPath);
  return config.resolve?.alias || {};
}
```

### Phase 5: Smart File System Lookup

#### 5.1 Extension Resolution

When import path has no extension, try multiple:

```typescript
function resolveWithExtensions(
  basePath: string,
  extensions: string[]
): string | null {
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  // Try index files
  for (const ext of extensions) {
    const indexFile = path.join(basePath, 'index' + ext);
    if (fileExists(indexFile)) {
      return indexFile;
    }
  }

  return null;
}
```

#### 5.2 Case-Insensitive Matching

Support case-insensitive file systems (Windows, macOS):

```typescript
function findFileIgnoreCase(targetPath: string): string | null {
  const dir = path.dirname(targetPath);
  const basename = path.basename(targetPath);

  const files = fs.readdirSync(dir);
  const match = files.find(f => f.toLowerCase() === basename.toLowerCase());

  return match ? path.join(dir, match) : null;
}
```

### Phase 6: Monorepo Support

#### 6.1 Detect Monorepo Structure

Look for:
- `lerna.json`
- `pnpm-workspace.yaml`
- `yarn workspaces` in package.json
- `nx.json`

#### 6.2 Workspace Package Resolution

```typescript
function resolveWorkspaceImport(
  importPath: string,
  workspaceConfig: WorkspaceConfig
): string | null {
  // Check if import references another workspace package
  for (const pkg of workspaceConfig.packages) {
    if (importPath.startsWith(pkg.name)) {
      const subPath = importPath.slice(pkg.name.length + 1);
      return path.join(pkg.location, subPath);
    }
  }

  return null;
}
```

## Implementation Plan

### Step 1: Enhanced Import Parser Architecture

```typescript
// New architecture
class ImportResolver {
  private config: ResolverConfig;
  private tsConfig?: TsConfig;
  private webpackConfig?: WebpackConfig;
  private pythonPaths: string[];

  constructor(projectRoot: string) {
    this.config = this.loadConfig(projectRoot);
    this.tsConfig = this.loadTsConfig(projectRoot);
    this.webpackConfig = this.loadWebpackConfig(projectRoot);
    this.pythonPaths = this.detectPythonPaths(projectRoot);
  }

  resolve(importPath: string, fromFile: string): string | null {
    // Priority order:
    // 1. Try exact match
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      return this.resolveRelative(importPath, fromFile);
    }

    // 2. Try custom aliases (.flaky-autopilot.json)
    if (this.config.aliases) {
      const aliasResolved = this.resolveAlias(importPath, this.config.aliases);
      if (aliasResolved) return aliasResolved;
    }

    // 3. Try TypeScript paths
    if (this.tsConfig) {
      const tsResolved = this.resolveTsConfigPath(importPath, this.tsConfig);
      if (tsResolved) return tsResolved;
    }

    // 4. Try webpack aliases
    if (this.webpackConfig) {
      const webpackResolved = this.resolveWebpackAlias(importPath);
      if (webpackResolved) return webpackResolved;
    }

    // 5. Try Python absolute imports
    if (fromFile.endsWith('.py')) {
      const pythonResolved = this.resolvePythonAbsolute(importPath);
      if (pythonResolved) return pythonResolved;
    }

    // 6. Try node_modules (but don't track - just for validation)
    // Return null for external packages

    return null;
  }

  private resolveAlias(importPath: string, aliases: AliasMap): string | null {
    for (const [alias, target] of Object.entries(aliases)) {
      if (importPath === alias || importPath.startsWith(alias + '/')) {
        const rest = importPath.slice(alias.length);
        return path.join(target, rest);
      }
    }
    return null;
  }
}
```

### Step 2: Configuration File Parsers

```typescript
interface ResolverConfig {
  aliases?: Record<string, string>;
  pythonPaths?: string[];
  extensions?: string[];
  moduleDirectories?: string[];
  baseUrl?: string;
}

class ConfigLoader {
  static load(projectRoot: string): ResolverConfig {
    // Priority order
    const configFiles = [
      '.flaky-autopilot.json',
      '.flaky-autopilot.js',
      'flaky-autopilot.config.js'
    ];

    for (const file of configFiles) {
      const configPath = path.join(projectRoot, file);
      if (fs.existsSync(configPath)) {
        return this.parseConfig(configPath);
      }
    }

    // Fallback: try to infer from other config files
    return this.inferConfig(projectRoot);
  }

  private static inferConfig(projectRoot: string): ResolverConfig {
    const config: ResolverConfig = {
      aliases: {},
      pythonPaths: ['.'],
      extensions: ['.js', '.ts', '.jsx', '.tsx'],
      moduleDirectories: ['node_modules']
    };

    // Try tsconfig.json
    const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
    if (fs.existsSync(tsConfigPath)) {
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      if (tsConfig.compilerOptions?.paths) {
        config.aliases = this.convertTsPathsToAliases(
          tsConfig.compilerOptions.paths,
          tsConfig.compilerOptions.baseUrl || '.'
        );
      }
    }

    // Try pytest.ini
    const pytestIni = path.join(projectRoot, 'pytest.ini');
    if (fs.existsSync(pytestIni)) {
      const iniContent = fs.readFileSync(pytestIni, 'utf-8');
      const pythonPathMatch = iniContent.match(/pythonpath\s*=\s*(.+)/);
      if (pythonPathMatch) {
        config.pythonPaths = pythonPathMatch[1].split(/\s+/);
      }
    }

    return config;
  }
}
```

### Step 3: Action Input Parameter

Add new action input for explicit config:

```yaml
# .github/workflows/test.yml
- uses: UnfoldAI-Labs/UnfoldCI-flaky-autopilot-action@v1
  with:
    api_key: ${{ secrets.FLAKY_AUTOPILOT_KEY }}
    junit_paths: '**/test-results/**/*.xml'
    # NEW: Optional resolver config
    import_aliases: |
      @=./src
      ~=./
      @utils=./src/utils
    python_paths: |
      .
      ./src
      ./tests
```

### Step 4: Backwards Compatibility

Ensure existing behavior is preserved:

```typescript
class ImportParser {
  private resolver: ImportResolver;

  parseImports(code: string, filePath: string): string[] {
    const language = detectLanguage(filePath);

    // Get raw imports using existing regex parsers
    const rawImports = this.parseRawImports(code, language, filePath);

    // NEW: Resolve each import using enhanced resolver
    const resolved: string[] = [];
    for (const imp of rawImports) {
      try {
        const resolvedPath = this.resolver.resolve(imp, filePath);
        if (resolvedPath) {
          // Verify file exists
          if (this.fileExists(resolvedPath)) {
            resolved.push(resolvedPath);
          }
        }
      } catch (error) {
        // Graceful degradation - skip this import
        console.warn(`⚠️  Could not resolve import: ${imp}`);
      }
    }

    return resolved;
  }

  private parseRawImports(code: string, language: string, filePath: string): string[] {
    // Keep existing regex-based parsers
    switch (language) {
      case 'javascript':
      case 'typescript':
        return this.parseJSImports(code, filePath);
      case 'python':
        return this.parsePythonImports(code, filePath);
      // ... etc
    }
  }
}
```

## Testing Strategy

### Test Cases

1. **TypeScript paths resolution**
   ```typescript
   import X from '@/utils';  // → src/utils
   import Y from '@components/Button';  // → src/components/Button
   ```

2. **Webpack aliases**
   ```javascript
   import X from '~/helpers';  // → ./helpers
   import Y from '@/api';  // → src/api
   ```

3. **Python absolute imports**
   ```python
   from helpers import util  // → tests/helpers.py
   from src.utils import db  // → src/utils/db.py
   ```

4. **Mixed scenarios**
   - Project with both tsconfig and webpack config
   - Python project with custom pythonpath
   - Monorepo with workspace packages

### Fallback Testing

Ensure graceful degradation when:
- Config files are malformed
- Aliases point to non-existent paths
- Circular import references
- Permission errors reading config

## Migration Path

### For Users

**Option 1: Zero config (automatic inference)**
- Action auto-detects tsconfig.json, webpack.config.js, pytest.ini
- Works out of the box for 80% of projects

**Option 2: Explicit config**
- Add `.flaky-autopilot.json` for full control
- Useful for complex alias setups

**Option 3: Action inputs**
- Pass aliases via workflow YAML
- Good for simple overrides

### Documentation Updates

1. Update IMPORT_SUPPORT.md with new capabilities
2. Add configuration guide
3. Provide migration examples
4. Document troubleshooting

## Performance Considerations

### Caching

```typescript
class ImportResolver {
  private cache = new Map<string, string | null>();

  resolve(importPath: string, fromFile: string): string | null {
    const cacheKey = `${fromFile}::${importPath}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const resolved = this.doResolve(importPath, fromFile);
    this.cache.set(cacheKey, resolved);
    return resolved;
  }
}
```

### Async File Operations

Use async fs operations to avoid blocking:

```typescript
async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path);
    return true;
  } catch {
    return false;
  }
}
```

## Security Considerations

1. **Sandbox config execution**: Don't use `eval()` on user configs
2. **Path traversal**: Validate resolved paths stay within project
3. **Config size limits**: Prevent huge config files
4. **Circular reference detection**: Prevent infinite loops

## Success Metrics

After implementation, measure:
- % of projects with successful import resolution
- Average imports detected per test
- User feedback on accuracy
- Performance impact (should be < 100ms per test)

## Next Steps

1. Implement ConfigLoader
2. Implement ImportResolver
3. Add tests for all resolution strategies
4. Update documentation
5. Beta test with diverse projects
6. Gather feedback and iterate
