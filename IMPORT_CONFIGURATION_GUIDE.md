# Import Configuration Guide

## Overview

The Flaky Autopilot action now supports **configuration-based import resolution** to handle non-standard import patterns like webpack aliases, TypeScript paths, and Python absolute imports.

## Quick Start

### Zero Configuration (Auto-Detection)

Most projects work out of the box! The action automatically detects:

- ✅ `tsconfig.json` - TypeScript path mappings
- ✅ `jsconfig.json` - JavaScript path mappings
- ✅ `pytest.ini` - Python paths
- ✅ `setup.cfg` - Python configuration
- ✅ `pyproject.toml` - Modern Python config

**No configuration needed** for standard setups.

### Custom Configuration

For complex setups or explicit control, create `.flaky-autopilot.json`:

```json
{
  "importResolver": {
    "aliases": {
      "@": "./src",
      "~": "./",
      "@utils": "./src/utils",
      "@components": "./src/components"
    },
    "pythonPaths": [".", "./src", "./tests"],
    "extensions": [".js", ".ts", ".jsx", ".tsx", ".vue", ".py"]
  }
}
```

## Configuration Options

### `import Resolver.aliases`

Map import aliases to actual file paths.

**Example:**
```json
{
  "importResolver": {
    "aliases": {
      "@": "./src",
      "~": "./",
      "#": "./src/components"
    }
  }
}
```

**Supported imports:**
```javascript
import utils from '@/utils';           // → src/utils
import Button from '#/Button';          // → src/components/Button
import config from '~/config';          // → ./config
```

### `importResolver.pythonPaths`

Specify directories to search for Python modules.

**Example:**
```json
{
  "importResolver": {
    "pythonPaths": [
      ".",
      "./src",
      "./tests"
    ]
  }
}
```

**Supported imports:**
```python
from helpers import utility  # Searches: ./helpers.py, ./src/helpers.py, ./tests/helpers.py
from utils.database import connect  # Searches in all pythonPaths
```

### `importResolver.extensions`

File extensions to try when resolving imports.

**Default:** `[".js", ".ts", ".jsx", ".tsx", ".vue", ".py"]`

**Example:**
```json
{
  "importResolver": {
    "extensions": [".js", ".ts", ".mjs", ".cjs", ".jsx"]
  }
}
```

## Auto-Detection Details

### TypeScript Projects

The action automatically reads `tsconfig.json`:

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@utils/*": ["utils/*"],
      "@components/*": ["components/*"]
    }
  }
}
```

**Result:** Aliases are automatically configured!

```typescript
import utils from '@/helpers';        // ✅ Resolves to src/helpers.ts
import Button from '@components/Button';  // ✅ Resolves to src/components/Button.tsx
```

### JavaScript Projects

Same as TypeScript, but reads `jsconfig.json`:

**jsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "~/*": ["./*"]
    }
  }
}
```

### Python Projects

#### Option 1: pytest.ini

**pytest.ini:**
```ini
[pytest]
pythonpath = . src tests
testpaths = tests
```

**Result:** Python paths automatically configured!

```python
from helpers import utility  # ✅ Searches ., src/, tests/
from utils.database import connect  # ✅ Works!
```

#### Option 2: setup.cfg

**setup.cfg:**
```ini
[tool:pytest]
pythonpath = . src
```

#### Option 3: pyproject.toml

**pyproject.toml:**
```toml
[tool.pytest.ini_options]
pythonpath = [".", "src", "tests"]
```

## Common Patterns

### Pattern 1: Monorepo with Shared Packages

```json
{
  "importResolver": {
    "aliases": {
      "@shared": "../shared/src",
      "@utils": "../utils/src",
      "@components": "./src/components"
    }
  }
}
```

### Pattern 2: Next.js Project

```json
{
  "importResolver": {
    "aliases": {
      "@": "./",
      "@/components": "./components",
      "@/lib": "./lib",
      "@/utils": "./utils"
    }
  }
}
```

### Pattern 3: Vue.js with @ Alias

Usually auto-detected from `jsconfig.json`, but you can override:

```json
{
  "importResolver": {
    "aliases": {
      "@": "./src"
    },
    "extensions": [".js", ".ts", ".vue"]
  }
}
```

### Pattern 4: Python with Complex Structure

```json
{
  "importResolver": {
    "pythonPaths": [
      ".",
      "./src",
      "./tests",
      "./tests/integration"
    ]
  }
}
```

## Migration from Legacy Behavior

### Before (Legacy - Relative Imports Only)

```javascript
// ❌ This didn't work
import utils from '@/utils';

// ✅ Only this worked
import utils from '../../../src/utils';
```

```python
# ❌ This didn't work
from helpers import utility

# ✅ Only this worked
from .helpers import utility
```

### After (Enhanced - Aliases Supported)

```javascript
// ✅ Both work now!
import utils from '@/utils';
import utils from '../../../src/utils';
```

```python
# ✅ Both work now! (with pythonPaths configured)
from helpers import utility
from .helpers import utility
```

## Troubleshooting

### Imports Not Being Detected

**Check the logs** in your GitHub Actions run:

```
📁 Import Resolver initialized
   Aliases detected: 3
   Python paths: ., ./src, ./tests

🔍 Calculating dependency hash for: YourTest test_name
  📦 Test: your-test-file.js
  🔗 Found 0 local import(s)  ← ⚠️ Problem!
```

**If you see "Found 0 local imports":**

1. Verify your config file is valid JSON
2. Check that alias paths exist
3. Ensure imports match configured aliases
4. Try explicit configuration in `.flaky-autopilot.json`

### Alias Not Resolving

**Debug steps:**

1. Check alias definition:
   ```json
   {
     "importResolver": {
       "aliases": {
         "@": "./src"  ← Path relative to project root
       }
     }
   }
   ```

2. Verify the target directory exists:
   ```
   project-root/
     src/          ← Must exist!
       utils.ts
     .flaky-autopilot.json
   ```

3. Check import statement:
   ```typescript
   import utils from '@/utils';  ← Must start with @ exactly
   ```

### Python Absolute Imports Not Working

**Checklist:**

1. ✅ Add `__init__.py` files to make directories packages:
   ```
   tests/
     __init__.py    ← Required!
     test_example.py
     helpers.py
   ```

2. ✅ Configure pythonPaths:
   ```json
   {
     "importResolver": {
       "pythonPaths": [".", "./tests"]
     }
   }
   ```

3. ✅ Use proper import syntax:
   ```python
   from helpers import utility  # ✅ Works with config
   from .helpers import utility  # ✅ Always works
   ```

## Performance

The enhanced resolver:
- ✅ Caches resolutions (fast repeated lookups)
- ✅ Graceful degradation (falls back to legacy if config fails)
- ✅ Minimal overhead (~5ms per test)

## Examples

### Full Configuration Example

**.flaky-autopilot.json:**
```json
{
  "version": "1.0",
  "importResolver": {
    "aliases": {
      "@": "./src",
      "@utils": "./src/utils",
      "@components": "./src/components",
      "~": "./",
      "#tests": "./tests"
    },
    "pythonPaths": [
      ".",
      "./src",
      "./tests"
    ],
    "extensions": [
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".vue",
      ".mjs",
      ".py"
    ]
  },
  "analysis": {
    "minRuns": 5,
    "flakeThreshold": 0.7
  }
}
```

### TypeScript + Webpack Project

**tsconfig.json** (auto-detected):
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "~/*": ["../*"]
    }
  }
}
```

**Result:** No `.flaky-autopilot.json` needed!

### Python + pytest Project

**pytest.ini** (auto-detected):
```ini
[pytest]
pythonpath = . src tests
testpaths = tests
python_files = test_*.py
```

**Result:** No `.flaky-autopilot.json` needed!

## Need Help?

If your import pattern isn't working:

1. Check this guide for similar patterns
2. Review the [IMPORT_SUPPORT.md](./IMPORT_SUPPORT.md) for language-specific details
3. Open an issue with:
   - Your config file
   - Example import statement
   - Expected vs actual behavior

## What's Next?

Future enhancements:
- Webpack config auto-detection
- Vite config auto-detection
- Monorepo workspace resolution
- Dynamic import support

Your feedback helps prioritize these features!
