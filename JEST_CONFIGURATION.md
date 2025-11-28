# Jest Configuration

## Required Configuration

Add to your `package.json`:

```json
{
  "scripts": {
    "test": "jest --reporters=default --reporters=jest-junit --forceExit --maxWorkers=1"
  },
  "jest-junit": {
    "outputDirectory": "./test-results",
    "outputName": "junit.xml",
    "usePathForSuiteName": "true"
  }
}
```

## Configuration Options

| Option | Purpose |
|--------|---------|
| `--forceExit` | Ensures Jest exits after tests complete and reporters write output |
| `--maxWorkers=1` | Runs tests serially to prevent race conditions |
| `usePathForSuiteName: true` | Includes file paths in XML for accurate test tracking |

## Common Issues

If Jest crashes before writing XML, check for:
- Unhandled promise rejections
- Async timers (`setTimeout`/`setInterval`) running after test completion
- Unclosed database connections or file handles

Fix by properly awaiting async operations and cleaning up resources in test teardown.
