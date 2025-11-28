"use strict";
/**
 * JUnit XML Parser
 * Extracts test results from JUnit XML format (Jest, Vitest, pytest, JUnit, etc.)
 *
 * Supports:
 * - Jest/Vitest (JavaScript/TypeScript)
 * - pytest/unittest/nose (Python)
 * - JUnit/TestNG (Java)
 * - PHPUnit (PHP)
 * - RSpec/Minitest (Ruby)
 * - Go testing
 * - Rust cargo test
 * - NUnit/xUnit (C#)
 */
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
exports.parseJUnitXML = parseJUnitXML;
const xml2js_1 = require("xml2js");
const fs = __importStar(require("fs"));
// Common test framework suite names that don't represent actual files
const GENERIC_SUITE_NAMES = new Set([
    'pytest', 'unittest', 'nose', 'nose2', 'py.test',
    'jest', 'vitest', 'mocha', 'jasmine', 'karma',
    'junit', 'testng', 'maven-surefire-plugin',
    'phpunit', 'codeception',
    'rspec', 'minitest',
    'go', 'testing',
    'cargo', 'rust',
    'nunit', 'xunit', 'mstest',
    'googletest', 'gtest', 'catch2'
]);
// File extensions for different languages
const FILE_EXTENSIONS = {
    py: '.py',
    python: '.py',
    js: '.js',
    javascript: '.js',
    ts: '.ts',
    typescript: '.ts',
    jsx: '.jsx',
    tsx: '.tsx',
    java: '.java',
    kt: '.kt',
    kotlin: '.kt',
    php: '.php',
    rb: '.rb',
    ruby: '.rb',
    go: '.go',
    golang: '.go',
    rs: '.rs',
    rust: '.rs',
    cs: '.cs',
    csharp: '.cs',
    cpp: '.cpp',
    c: '.c',
    swift: '.swift',
};
/**
 * Detect the likely language/framework from various hints
 */
function detectLanguage(suiteName, classname, filePath) {
    const combined = `${suiteName} ${classname} ${filePath}`.toLowerCase();
    // Python indicators
    if (combined.includes('pytest') || combined.includes('unittest') ||
        combined.includes('nose') || classname.includes('test_') ||
        combined.match(/tests?\.[a-z_]+\.[A-Z]/) || // tests.module.TestClass
        combined.match(/^test_[a-z]/)) {
        return 'py';
    }
    // JavaScript/TypeScript indicators  
    if (combined.includes('jest') || combined.includes('vitest') ||
        combined.includes('mocha') || combined.includes('.test.') ||
        combined.includes('.spec.') || combined.match(/\.(js|ts|jsx|tsx)$/)) {
        return combined.includes('tsx') ? 'tsx' : combined.includes('ts') ? 'ts' : 'js';
    }
    // Java indicators
    if (combined.match(/^com\.|^org\.|^net\./) || combined.includes('junit') ||
        combined.includes('testng') || combined.includes('maven')) {
        return 'java';
    }
    // PHP indicators
    if (combined.includes('phpunit') || combined.includes('\\tests\\') ||
        classname.includes('\\') || combined.match(/test\.php$/)) {
        return 'php';
    }
    // Ruby indicators
    if (combined.includes('rspec') || combined.includes('minitest') ||
        combined.includes('_spec') || combined.match(/spec\./)) {
        return 'rb';
    }
    // Go indicators
    if (combined.match(/_test$/) || combined.includes('go test') ||
        suiteName.match(/^[a-z]+$/) && classname.match(/^Test[A-Z]/)) {
        return 'go';
    }
    // Rust indicators
    if (combined.includes('cargo') || classname.includes('::')) {
        return 'rs';
    }
    // C# indicators
    if (combined.includes('nunit') || combined.includes('xunit') ||
        combined.includes('mstest') || classname.match(/^[A-Z][a-zA-Z]+\.[A-Z]/)) {
        return 'cs';
    }
    return null;
}
/**
 * Convert a Python module path to a file path
 * Examples:
 * - tests.test_async.TestClass → tests/test_async.py
 * - my_package.tests.test_file.TestClass → my_package/tests/test_file.py
 * - test_something → tests/test_something.py
 */
function pythonModuleToPath(modulePath) {
    const parts = modulePath.split('.');
    // Filter out class names (PascalCase) and keep module/directory names
    const pathParts = [];
    for (const part of parts) {
        // Skip if it looks like a class name (starts with capital, no underscores at start)
        if (part.match(/^[A-Z][a-zA-Z0-9]*$/) && !part.startsWith('Test_')) {
            continue;
        }
        // Skip if it's a test method name
        if (part.startsWith('test_') && pathParts.length > 0 && pathParts[pathParts.length - 1].startsWith('test_')) {
            continue;
        }
        pathParts.push(part);
    }
    if (pathParts.length === 0) {
        return modulePath.replace(/\./g, '/') + '.py';
    }
    // If we just have a test_* name without directory, add tests/
    if (pathParts.length === 1 && pathParts[0].startsWith('test_')) {
        return `tests/${pathParts[0]}.py`;
    }
    return pathParts.join('/') + '.py';
}
/**
 * Convert a PHP namespace to a file path
 * Example: App\Tests\Unit\SomeTest → tests/Unit/SomeTest.php
 */
function phpNamespaceToPath(namespace) {
    let path = namespace.replace(/\\/g, '/');
    // Remove common namespace prefixes
    path = path.replace(/^(App|Src|Lib)\//i, '');
    // Ensure tests directory
    if (!path.toLowerCase().startsWith('tests/')) {
        if (path.toLowerCase().includes('/tests/')) {
            path = path.substring(path.toLowerCase().indexOf('/tests/') + 1);
        }
        else {
            path = 'tests/' + path;
        }
    }
    return path + '.php';
}
/**
 * Convert a Java package to a file path
 * Example: com.example.tests.UserTest → src/test/java/com/example/tests/UserTest.java
 */
function javaPackageToPath(packagePath) {
    const path = packagePath.replace(/\./g, '/');
    // Check if it's likely a test file
    if (path.toLowerCase().includes('test')) {
        return `src/test/java/${path}.java`;
    }
    return `${path}.java`;
}
/**
 * Convert a Rust module path to a file path
 * Example: my_crate::tests::test_module → tests/test_module.rs or src/tests.rs
 */
function rustModuleToPath(modulePath) {
    const parts = modulePath.split('::');
    // Filter out test function names
    const pathParts = parts.filter(p => !p.startsWith('test_') || p.includes('test_'));
    if (pathParts.length === 1) {
        return `src/${pathParts[0]}.rs`;
    }
    // If it contains 'tests', use tests directory
    if (pathParts.includes('tests')) {
        const testIdx = pathParts.indexOf('tests');
        return pathParts.slice(testIdx).join('/') + '.rs';
    }
    return 'src/' + pathParts.join('/') + '.rs';
}
/**
 * Convert a C# namespace to a file path
 * Example: MyProject.Tests.Unit.UserTests → Tests/Unit/UserTests.cs
 */
function csharpNamespaceToPath(namespace) {
    const parts = namespace.split('.');
    // Find where 'Tests' starts
    const testIdx = parts.findIndex(p => p.toLowerCase().includes('test'));
    if (testIdx >= 0) {
        return parts.slice(testIdx).join('/') + '.cs';
    }
    return parts.join('/') + '.cs';
}
/**
 * Try to extract file path from error message
 */
function extractFileFromError(errorText) {
    if (!errorText || typeof errorText !== 'string')
        return null;
    // Common patterns for file paths in error messages
    const patterns = [
        // Jest/Node: (path/to/file.test.js:10:5)
        /\(([^)]+\.(test|spec)\.(js|ts|jsx|tsx|mjs|cjs)):\d+:\d+\)/,
        // Python: File "path/to/file.py", line 10
        /File "([^"]+\.py)", line \d+/,
        // Java: at com.example.Test(Test.java:10)
        /at [^(]+\(([^)]+\.java):\d+\)/,
        // Generic: path/to/file.ext:line:col
        /([a-zA-Z0-9_\-./\\]+\.(py|js|ts|jsx|tsx|java|rb|php|go|rs|cs|cpp|c|swift)):\d+/,
        // Windows paths
        /([A-Z]:\\[^:]+\.(py|js|ts|jsx|tsx|java|rb|php|go|rs|cs|cpp|c|swift)):\d+/i,
    ];
    for (const pattern of patterns) {
        const match = errorText.match(pattern);
        if (match) {
            let path = match[1].replace(/\\/g, '/');
            // Remove absolute path prefix, keep from tests/ or src/
            path = path.replace(/^.*?([a-zA-Z0-9_-]+\/(tests?|specs?|src)\/)/, '$1');
            return path;
        }
    }
    return null;
}
async function parseJUnitXML(filePath) {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = await (0, xml2js_1.parseStringPromise)(xmlContent);
    const results = [];
    // Handle both <testsuites><testsuite> and direct <testsuite>
    let testsuites = parsed.testsuites?.testsuite || [];
    if (parsed.testsuite) {
        testsuites = Array.isArray(parsed.testsuite) ? parsed.testsuite : [parsed.testsuite];
    }
    if (!Array.isArray(testsuites)) {
        testsuites = [testsuites];
    }
    for (const testsuite of testsuites) {
        if (!testsuite || !testsuite.testcase)
            continue;
        const testcases = Array.isArray(testsuite.testcase) ? testsuite.testcase : [testsuite.testcase];
        const suiteName = testsuite.$?.name || '';
        for (const testcase of testcases) {
            if (!testcase || !testcase.$)
                continue;
            const attrs = testcase.$;
            const classname = attrs.classname || '';
            // Determine outcome
            const hasFailure = testcase.failure && testcase.failure.length > 0;
            const hasError = testcase.error && testcase.error.length > 0;
            const wasSkipped = testcase.skipped && testcase.skipped.length > 0;
            if (wasSkipped)
                continue;
            const outcome = (hasFailure || hasError) ? 'failed' : 'passed';
            // Start with explicit file attribute if present
            let file = attrs.file || '';
            // Normalize Windows paths
            if (file) {
                file = file.replace(/\\/g, '/');
            }
            // If no file, try to determine from other attributes
            if (!file || file === 'unknown') {
                // Detect language to help with conversion
                const lang = detectLanguage(suiteName, classname, file);
                // Try suite name first if it looks like a file path
                if (suiteName.match(/\.(js|ts|jsx|tsx|py|java|rb|php|go|rs|cs|cpp|c|swift)$/i)) {
                    file = suiteName.replace(/\\/g, '/');
                }
                // Try classname if suite name is generic
                else if (GENERIC_SUITE_NAMES.has(suiteName.toLowerCase()) || !suiteName) {
                    file = classname;
                }
                // Use classname if it has dots (likely a module path)
                else if (classname && classname.includes('.')) {
                    file = classname;
                }
                // Fall back to suite name
                else {
                    file = suiteName || classname || 'unknown';
                }
                // Now convert module paths to file paths based on language
                if (file && !file.match(/\.(js|ts|jsx|tsx|py|java|rb|php|go|rs|cs|cpp|c|swift)$/i)) {
                    if (lang === 'py' || file.match(/^tests?\.|test_|_test$/)) {
                        file = pythonModuleToPath(file);
                    }
                    else if (lang === 'php' || file.includes('\\')) {
                        file = phpNamespaceToPath(file);
                    }
                    else if (lang === 'java' || file.match(/^(com|org|net)\./)) {
                        file = javaPackageToPath(file);
                    }
                    else if (lang === 'rb' || file.match(/^spec\.|_spec$/)) {
                        file = file.replace(/\./g, '/') + '.rb';
                    }
                    else if (lang === 'go') {
                        file = file.replace(/\./g, '/') + '_test.go';
                    }
                    else if (lang === 'rs' || file.includes('::')) {
                        file = rustModuleToPath(file);
                    }
                    else if (lang === 'cs') {
                        file = csharpNamespaceToPath(file);
                    }
                    else if (file.includes('.')) {
                        // Generic dot-separated path - try to infer
                        if (file.match(/Test|Spec/i)) {
                            // Likely a test class, keep as-is with .js fallback
                            file = file.replace(/\./g, '/') + '.js';
                        }
                    }
                }
            }
            // Try to extract file path from error message if we still don't have a good path
            if ((!file || file === 'unknown' || !file.includes('/')) && (hasFailure || hasError)) {
                const errorText = hasFailure
                    ? (testcase.failure[0]?._ || testcase.failure[0] || '')
                    : (testcase.error[0]?._ || testcase.error[0] || '');
                const extractedFile = extractFileFromError(errorText);
                if (extractedFile) {
                    file = extractedFile;
                }
            }
            // Final fallback - create a reasonable path
            if (!file || file === 'unknown') {
                const testName = attrs.name || 'unknown';
                const sanitized = testName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 50);
                file = `tests/${sanitized}.test.js`;
            }
            // Clean up the file path
            file = file
                .replace(/\\/g, '/')
                .replace(/\/+/g, '/')
                .replace(/^\//, '');
            results.push({
                name: attrs.name || 'unknown',
                file: file,
                outcome: outcome,
                duration_ms: parseFloat(attrs.time || '0') * 1000,
                error_message: hasFailure
                    ? (testcase.failure[0]?._ || String(testcase.failure[0] || ''))
                    : hasError
                        ? (testcase.error[0]?._ || String(testcase.error[0] || ''))
                        : undefined,
            });
        }
    }
    return results;
}
