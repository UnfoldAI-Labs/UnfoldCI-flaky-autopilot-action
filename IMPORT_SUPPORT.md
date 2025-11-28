# Import Detection Support

The Flaky Autopilot action automatically detects and tracks imports in your test files to calculate dependency-aware hashes. This ensures that when a dependency changes, the test hash changes too, triggering re-analysis.

## Supported Languages & Import Styles

### JavaScript & TypeScript ✅

**Fully Supported:**
```javascript
// ES6 imports - All styles work
import utils from './utils';
import { helper } from '../helpers';
import * as api from './api-client';

// CommonJS require - All styles work
const utils = require('./utils');
const { helper } = require('../helpers');
```

Both ES6 and CommonJS imports are detected. The action automatically resolves missing file extensions (`.js`, `.ts`, `.jsx`, `.tsx`).

### Python ⚠️

**Supported (Relative Imports Only):**
```python
# ✅ These work - Relative imports
from .helpers import utility
from ..utils.database import connect
from ...lib.config import settings

# ❌ These DON'T work - Absolute imports
from helpers import utility
import database
from utils.config import settings
```

**Important:** Use relative imports (starting with `.`) in your Python test files.

**Recommended Project Structure:**
```
tests/
  __init__.py          # Required!
  test_example.py
  helpers.py
  utils/
    __init__.py        # Required!
    database.py
```

### C/C++ ✅

**Supported (Local Includes Only):**
```cpp
// ✅ These work - Local includes with quotes
#include "../../src/utils.h"
#include "../helpers/math.hpp"

// ❌ These DON'T work - System includes with angle brackets
#include <iostream>
#include <vector>
```

Only local header files (using `"quotes"`) are tracked, not system libraries (using `<angle brackets>`).

### Java ✅

**Supported (Package Imports):**
```java
// ✅ These work - Custom package imports
import com.example.utils.Helper;
import com.myapp.database.Connection;

// ❌ These DON'T work - Standard library (filtered out)
import java.util.List;
import javax.servlet.Http;
```

### Go ✅

**Supported (Local Packages Only):**
```go
// ✅ These work - Local imports
import "./helpers"
import (
  "./utils"
  "./database"
)

// ❌ These DON'T work - External packages
import "fmt"
import "github.com/user/repo"
```

### Ruby ✅

**Supported:**
```ruby
# ✅ All these work
require './helpers'
require_relative '../utils/database'

# ❌ These DON'T work - Gems (filtered out)
require 'rails'
require 'rspec'
```

### C# ✅

**Supported:**
```csharp
// ✅ These work - Custom namespaces
using MyApp.Utils;
using MyApp.Database;

// ❌ These DON'T work - System namespaces
using System.Collections;
using System.IO;
```

### PHP ✅

**Supported:**
```php
// ✅ These work - Local requires
require './helpers.php';
include_once '../utils/database.php';

// ✅ These work - Namespace imports
use MyApp\Utils\Helper;
use MyApp\Database\Connection;
```

### Rust ✅

**Supported (Crate Modules Only):**
```rust
// ✅ These work - Crate modules
use crate::utils::helper;
use crate::database::connection;

// ❌ These DON'T work - External crates
use std::collections::HashMap;
use serde::Serialize;
```

### Kotlin ✅

**Supported:**
```kotlin
// ✅ These work - Custom packages
import com.example.utils.Helper
import com.myapp.database.Connection

// ❌ These DON'T work - Standard library
import kotlin.collections.List
import android.app.Activity
```

### Swift ✅

**Supported (Local Modules Only):**
```swift
// ✅ These work - Local imports
import ./MyModule
import ./Utils

// ❌ These DON'T work - Framework imports
import Foundation
import UIKit
```

## What Gets Filtered Out (By Design)

The action intentionally ignores external dependencies to focus on YOUR code:

- ❌ npm packages (node_modules)
- ❌ Python pip packages (site-packages)
- ❌ Java maven/gradle dependencies
- ❌ Go external modules
- ❌ Ruby gems
- ❌ System libraries
- ❌ Framework imports

**Why?** External package versions are typically managed separately (package.json, requirements.txt, etc.). The action focuses on detecting changes in YOUR local code that affects tests.

## Known Limitations

### 1. Dynamic Imports Not Supported

```javascript
// ❌ Variable paths not detected
const path = './utils';
import(path);
require(variablePath);

// ✅ Static paths work
import('./utils');
require('./utils');
```

### 2. Build Tool Aliases Not Resolved

```javascript
// ❌ Webpack/Vite aliases not resolved
import X from '@/utils';
import Y from '~/helpers';

// ✅ Use relative paths
import X from '../../utils';
import Y from '../helpers';
```

### 3. Conditional Imports May Be Missed

```python
# ❌ May not be detected
if condition:
    from .helpers import X
```

## What Happens If Imports Aren't Detected?

**Good news:** Your tests still work! The action gracefully degrades:

- ✅ Test pass/fail tracking still works
- ✅ Flaky test detection still works
- ✅ AI-generated fixes still work
- ⚠️ Dependency hash won't include imported files
- ⚠️ Changes to dependencies won't trigger re-analysis

**Impact:** If your helper file changes but the test file doesn't, the action won't automatically re-analyze that test. You can still manually trigger analysis by modifying the test file.

## Best Practices

### For Python Projects:

1. Always use relative imports in test files:
   ```python
   from .helpers import utility  # ✅ Good
   from helpers import utility    # ❌ Won't be detected
   ```

2. Add `__init__.py` files to make directories proper packages:
   ```
   tests/
     __init__.py     # Required!
     test_*.py
     helpers.py
   ```

### For All Projects:

1. **Prefer relative paths** over build tool aliases
2. **Avoid dynamic imports** with variable paths
3. **Co-locate test helpers** with test files
4. **Use explicit import statements** (not conditionals)

## Checking Import Detection

To verify imports are being detected, check your GitHub Actions logs for:

```
🔍 Calculating dependency hash for: YourTest test_name
  📦 Test: your-test-file.js
  🔗 Found 3 local import(s)
     ✅ utils
     ✅ database
     ✅ auth-helper
  🔐 Combined hash: abc123...
```

If you see `Found 0 local import(s)`, check:
1. Are you using supported import syntax?
2. Are imports relative/local (not external packages)?
3. Are there any typos in import paths?

## Need Help?

If your import pattern isn't being detected and you believe it should be:

1. Check this document for supported patterns
2. Verify your imports are local (not external packages)
3. Open an issue with a code example

Remember: External packages (npm, pip, etc.) are intentionally filtered out - only YOUR local code imports are tracked.
