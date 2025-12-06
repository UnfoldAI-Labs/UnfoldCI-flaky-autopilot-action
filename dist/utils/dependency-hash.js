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
exports.calculateDependencyHash = calculateDependencyHash;
exports.getDependencies = getDependencies;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const hash_1 = require("./hash");
const import_parser_1 = require("./import-parser");
async function calculateDependencyHash(testFilePath) {
    try {
        const testContent = fs.readFileSync(testFilePath, 'utf-8');
        const importPaths = (0, import_parser_1.parseImports)(testContent, testFilePath);
        console.log(`    📦 Test: ${path.basename(testFilePath)}`);
        console.log(`    🔗 Found ${importPaths.length} local import(s)`);
        const dependencyContents = [];
        for (const importPath of importPaths) {
            const content = await readDependencyFile(importPath, testFilePath);
            if (content) {
                dependencyContents.push(content);
                console.log(`       ✅ ${path.basename(importPath)}`);
            }
            else {
                dependencyContents.push(`// MISSING: ${importPath}`);
                console.log(`       ⚠️  ${path.basename(importPath)} (not found locally - using placeholder)`);
            }
        }
        const combinedContent = testContent + '\n' + dependencyContents.join('\n');
        const hash = (0, hash_1.calculateContentHash)(combinedContent);
        console.log(`    🔐 Combined hash: ${hash.substring(0, 12)}...`);
        return hash;
    }
    catch (error) {
        console.warn(`⚠️  Failed to calculate dependency hash for ${testFilePath}:`, error.message);
        // If we can't read the file (doesn't exist locally), just hash the path
        // This is fine - we'll still track outcomes, just can't detect code changes
        try {
            const content = fs.readFileSync(testFilePath, 'utf-8');
            return (0, hash_1.calculateContentHash)(content);
        }
        catch {
            // File doesn't exist locally - use path-based hash as fallback
            console.warn(`   📁 File not found locally, using path-based hash`);
            return (0, hash_1.calculateContentHash)(`PATH:${testFilePath}`);
        }
    }
}
async function readDependencyFile(importPath, testFilePath) {
    const language = (0, import_parser_1.detectLanguage)(testFilePath);
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
    if (path.extname(importPath)) {
        try {
            return fs.readFileSync(importPath, 'utf-8');
        }
        catch {
            return null;
        }
    }
    for (const ext of extensions) {
        try {
            const fullPath = importPath + ext;
            return fs.readFileSync(fullPath, 'utf-8');
        }
        catch {
            continue;
        }
    }
    return null;
}
function getDependencies(testFilePath) {
    try {
        const content = fs.readFileSync(testFilePath, 'utf-8');
        return (0, import_parser_1.parseImports)(content, testFilePath);
    }
    catch {
        return [];
    }
}
