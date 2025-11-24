"use strict";
/**
 * Dependency Hash Calculator
 *
 * Creates a hash of test file + all its direct dependencies
 * This prevents false positives when implementation code changes
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
exports.calculateDependencyHash = calculateDependencyHash;
exports.getDependencies = getDependencies;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const hash_1 = require("./hash");
const import_parser_1 = require("./import-parser");
/**
 * Calculate combined hash of test file + its dependencies
 *
 * Algorithm:
 * 1. Read test file content
 * 2. Parse imports to find direct dependencies
 * 3. Read each dependency file (with extension variants)
 * 4. Concatenate all content: test + dep1 + dep2 + ...
 * 5. Hash the combined content
 *
 * This ensures hash changes when:
 * - Test code changes ✅
 * - Any imported file changes ✅
 *
 * Hash stays same when:
 * - Unrelated implementation code changes ✅
 * - Tests that don't import the changed code ✅
 */
async function calculateDependencyHash(testFilePath) {
    try {
        // Step 1: Read test file
        const testContent = fs.readFileSync(testFilePath, 'utf-8');
        // Step 2: Parse imports
        const importPaths = (0, import_parser_1.parseImports)(testContent, testFilePath);
        console.log(`    📦 Test: ${path.basename(testFilePath)}`);
        console.log(`    🔗 Found ${importPaths.length} local import(s)`);
        // Step 3: Read dependency files
        const dependencyContents = [];
        for (const importPath of importPaths) {
            const content = await readDependencyFile(importPath, testFilePath);
            if (content) {
                dependencyContents.push(content);
                console.log(`       ✅ ${path.basename(importPath)}`);
            }
            else {
                // Use placeholder for missing files to maintain deterministic hash
                // This ensures hash stays consistent if file isn't found in CI environment
                dependencyContents.push(`// MISSING: ${importPath}`);
                console.log(`       ⚠️  ${path.basename(importPath)} (not found locally - using placeholder)`);
            }
        }
        // Step 4: Combine all content (test + dependencies)
        const combinedContent = testContent + '\n' + dependencyContents.join('\n');
        // Step 5: Hash combined content
        const hash = (0, hash_1.calculateContentHash)(combinedContent);
        console.log(`    🔐 Combined hash: ${hash.substring(0, 12)}...`);
        return hash;
    }
    catch (error) {
        console.warn(`⚠️  Failed to calculate dependency hash for ${testFilePath}:`, error.message);
        // Fallback to simple file hash
        const content = fs.readFileSync(testFilePath, 'utf-8');
        return (0, hash_1.calculateContentHash)(content);
    }
}
/**
 * Read dependency file with multiple extension attempts
 *
 * For JS/TS: tries .ts, .tsx, .js, .jsx
 * For Python: tries .py
 * For others: tries the direct path
 */
async function readDependencyFile(importPath, testFilePath) {
    const language = (0, import_parser_1.detectLanguage)(testFilePath);
    // Determine which extensions to try based on language
    let extensions = [];
    if (language === 'javascript' || language === 'typescript') {
        extensions = ['.ts', '.tsx', '.js', '.jsx'];
    }
    else if (language === 'python') {
        extensions = ['.py', '/__init__.py'];
    }
    else if (language === 'java') {
        extensions = ['.java'];
    }
    else if (language === 'go') {
        extensions = ['.go'];
    }
    else if (language === 'ruby') {
        extensions = ['.rb'];
    }
    else if (language === 'csharp') {
        extensions = ['.cs'];
    }
    else if (language === 'php') {
        extensions = ['.php'];
    }
    else if (language === 'rust') {
        extensions = ['.rs'];
    }
    else if (language === 'kotlin') {
        extensions = ['.kt'];
    }
    else if (language === 'swift') {
        extensions = ['.swift'];
    }
    // If path already has extension, try it directly first
    if (path.extname(importPath)) {
        try {
            return fs.readFileSync(importPath, 'utf-8');
        }
        catch {
            return null;
        }
    }
    // Try each extension
    for (const ext of extensions) {
        try {
            const fullPath = importPath + ext;
            return fs.readFileSync(fullPath, 'utf-8');
        }
        catch {
            // Try next extension
        }
    }
    return null;
}
/**
 * Get list of dependencies for a test file (for debugging)
 */
function getDependencies(testFilePath) {
    try {
        const content = fs.readFileSync(testFilePath, 'utf-8');
        return (0, import_parser_1.parseImports)(content, testFilePath);
    }
    catch {
        return [];
    }
}
