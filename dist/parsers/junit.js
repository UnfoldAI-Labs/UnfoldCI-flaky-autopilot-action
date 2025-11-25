"use strict";
/**
 * JUnit XML Parser
 * Extracts test results from JUnit XML format (Jest, Vitest, pytest, JUnit, etc.)
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
async function parseJUnitXML(filePath) {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = await (0, xml2js_1.parseStringPromise)(xmlContent);
    const results = [];
    // JUnit XML structure: <testsuites><testsuite><testcase>
    const testsuites = parsed.testsuites?.testsuite || [parsed.testsuite];
    for (const testsuite of testsuites) {
        if (!testsuite.testcase)
            continue;
        const testcases = Array.isArray(testsuite.testcase) ? testsuite.testcase : [testsuite.testcase];
        for (const testcase of testcases) {
            const attrs = testcase.$;
            // Determine outcome
            const hasFailure = testcase.failure && testcase.failure.length > 0; // Changed: hasfailure → hasFailure
            const hasError = testcase.error && testcase.error.length > 0;
            const wasSkipped = testcase.skipped && testcase.skipped.length > 0;
            if (wasSkipped)
                continue;
            const outcome = (hasFailure || hasError) ? 'failed' : 'passed';
            let file = attrs.file || 'unknown';
            if (file === 'unknown' && testsuite.$.name) {
                const suiteName = testsuite.$.name;
                if (suiteName.match(/\.(js|ts|jsx|tsx|py|java|go|rb|php|rs|kt|swift|c|cpp|cc|cxx|h|hpp)$/)) {
                    file = suiteName.replace(/\\/g, '/');
                }
                else {
                    file = attrs.classname || suiteName;
                }
            }
            else if (file === 'unknown') {
                file = attrs.classname || testsuite.$.name || 'unknown';
            }
            if ((hasFailure || hasError) && !file.includes('/') && !file.includes('\\')) {
                const errorText = hasFailure ? testcase.failure[0]._ || testcase.failure[0] : testcase.error[0]._ || testcase.error[0];
                if (typeof errorText === 'string') {
                    const fileMatch = errorText.match(/\(([^)]+\.(test|spec)\.(js|ts|jsx|tsx|py|java|go|rb|php|rs|kt|swift|c|cpp|cc|cxx|h|hpp)):\d+:\d+\)/);
                    if (fileMatch) {
                        let extractedPath = fileMatch[1].replace(/\\/g, '/');
                        extractedPath = extractedPath.replace(/^[A-Z]:[\/\\].*?([^\/\\]+\/(test|spec)s?\/)/i, '$1');
                        extractedPath = extractedPath.replace(/^\/.*?([^\/]+\/(test|spec)s?\/)/i, '$1');
                        file = extractedPath;
                    }
                }
            }
            if (!file.match(/\.(js|ts|jsx|tsx|py|java|go|rb|php|rs|kt|swift|c|cpp|cc|cxx|h|hpp)$/)) {
                // Handle pytest format: tests.python-deps.test_with_imports → tests/python-deps/test_with_imports.py
                if (file.startsWith('tests.')) {
                    const parts = file.split('.');
                    if (parts.length >= 2) {
                        // Convert dots to slashes for directory structure
                        file = parts.join('/') + '.py';
                    }
                }
                // Handle Ruby/RSpec format: spec.models.user_spec → spec/models/user_spec.rb
                else if (file.startsWith('spec.')) {
                    const parts = file.split('.');
                    if (parts.length >= 2) {
                        file = parts.join('/') + '.rb';
                    }
                }
                // Handle Java format: com.example.TestClass → com/example/TestClass.java
                else if (file.includes('.') && file.match(/^[a-z]+\.[a-z]/)) {
                    file = file.replace(/\./g, '/') + '.java';
                }
                // Handle Go format: package.TestFunction → package/test.go
                else if (file.includes('.') && file.match(/^[a-z]+\.(Test|Benchmark)/)) {
                    const parts = file.split('.');
                    file = `${parts[0]}/test.go`;
                }
                // Handle single-word test files: test_something → tests/test_something.py
                else if (file.startsWith('test_') && !file.includes('.')) {
                    file = `tests/${file}.py`;
                }
                // Generic fallback: use suite name if available
                else if (testsuite.$.name && !file.includes('.')) {
                    const suiteName = testsuite.$.name.toLowerCase().replace(/\s+/g, '-');
                    file = `tests/${suiteName}.test.js`;
                }
            }
            results.push({
                name: attrs.name,
                file: file,
                outcome: outcome,
                duration_ms: parseFloat(attrs.time || '0') * 1000,
                error_message: hasFailure ? testcase.failure[0]._ : hasError ? testcase.error[0]._ : undefined,
            });
        }
    }
    return results;
}
