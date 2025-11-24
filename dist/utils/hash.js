"use strict";
/**
 * Calculate file content hash to detect code changes
 *
 * CRITICAL: Only aggregate test results if code hasn't changed!
 * Different code = different test = don't mix results
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
exports.calculateFileHash = calculateFileHash;
exports.calculateContentHash = calculateContentHash;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
/**
 * Calculate SHA-256 hash of file content
 * Used to detect if test code changed between runs
 */
async function calculateFileHash(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    catch {
        // File not found locally (might be in container)
        // Return placeholder - API will fetch from GitHub
        return 'unknown';
    }
}
/**
 * Calculate hash from file content (for GitHub API fetched content)
 */
function calculateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}
