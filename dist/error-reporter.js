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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorTypes = void 0;
exports.reportError = reportError;
const github = __importStar(require("@actions/github"));
const axios_1 = __importDefault(require("axios"));
/**
 * Safely get repo context - works even if GITHUB_TOKEN is missing
 * Uses GITHUB_REPOSITORY env var as fallback (most reliable method)
 */
function getRepoContext() {
    // Method 1: Try GITHUB_REPOSITORY env var directly first (most reliable)
    // This is always available in GitHub Actions and doesn't require GITHUB_TOKEN
    const githubRepo = process.env.GITHUB_REPOSITORY;
    if (githubRepo && githubRepo.includes('/')) {
        const slashIndex = githubRepo.indexOf('/');
        const owner = githubRepo.substring(0, slashIndex);
        const repo = githubRepo.substring(slashIndex + 1);
        if (owner && owner.length > 0 && repo && repo.length > 0) {
            return { owner, repo };
        }
    }
    // Method 2: Try @actions/github context
    try {
        const context = github.context;
        const repoData = context.repo;
        if (repoData && repoData.owner && repoData.owner.length > 0 &&
            repoData.repo && repoData.repo.length > 0) {
            return { owner: repoData.owner, repo: repoData.repo };
        }
    }
    catch (e) {
        // context.repo getter might throw if env vars are missing
    }
    // Last resort fallback
    return { owner: 'unknown', repo: 'unknown' };
}
/**
 * Safely get workflow context
 */
function getWorkflowContext() {
    try {
        const context = github.context;
        return {
            workflow: context.workflow,
            job: context.job,
            runId: context.runId?.toString(),
            eventName: context.eventName,
            ref: context.ref,
            sha: context.sha,
            actor: context.actor,
            installationId: context.payload?.installation?.id,
        };
    }
    catch (e) {
        // Fallback to env vars
        return {
            workflow: process.env.GITHUB_WORKFLOW,
            job: process.env.GITHUB_JOB,
            runId: process.env.GITHUB_RUN_ID,
            eventName: process.env.GITHUB_EVENT_NAME,
            ref: process.env.GITHUB_REF,
            sha: process.env.GITHUB_SHA,
            actor: process.env.GITHUB_ACTOR,
            installationId: undefined,
        };
    }
}
/**
 * Reports errors to the UnfoldCI API for telemetry and debugging.
 * This helps the UnfoldCI team understand what issues users face.
 *
 * Note: This is non-blocking and will not fail the action if reporting fails.
 */
async function reportError(apiUrl, apiKey, error) {
    try {
        // ✅ Use defensive getters that won't throw
        const repoContext = getRepoContext();
        const workflowContext = getWorkflowContext();
        const payload = {
            installation_id: workflowContext.installationId,
            repo_name: repoContext.repo,
            repo_owner: repoContext.owner,
            // Error details
            error_type: error.error_type,
            error_message: error.error_message,
            error_stack: error.error_stack,
            // Context
            action_version: process.env.npm_package_version || '1.0.0',
            node_version: process.version,
            runner_os: process.env.RUNNER_OS || process.platform,
            workflow_name: workflowContext.workflow,
            job_name: workflowContext.job,
            run_id: workflowContext.runId,
            run_attempt: parseInt(process.env.GITHUB_RUN_ATTEMPT || '1'),
            // Test framework info
            results_path: error.results_path,
            files_found: error.files_found,
            test_framework: error.test_framework,
            // Additional metadata
            metadata: {
                ...error.metadata,
                event_name: workflowContext.eventName,
                ref: workflowContext.ref,
                sha: workflowContext.sha,
                actor: workflowContext.actor,
                // Debug info
                debug_github_repository: process.env.GITHUB_REPOSITORY || '(not set)',
                debug_github_token_present: !!process.env.GITHUB_TOKEN,
            },
        };
        // Send to error reporting endpoint
        const endpoint = `${apiUrl}/api/webhooks/error-report`;
        await axios_1.default.post(endpoint, payload, {
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'X-API-Key': apiKey } : {}),
            },
            timeout: 5000, // 5 second timeout - don't slow down the action
        });
        console.log('📊 Error reported to UnfoldCI for analysis');
    }
    catch (reportingError) {
        // Silently fail - we don't want error reporting to break the action
        console.log('ℹ️  Could not report error telemetry (non-critical)');
    }
}
/**
 * Error types for categorization
 */
exports.ErrorTypes = {
    // XML/Parsing issues
    XML_NOT_FOUND: 'xml_not_found',
    XML_PARSE_ERROR: 'xml_parse_error',
    XML_INVALID_FORMAT: 'xml_invalid_format',
    // API issues
    API_ERROR: 'api_error',
    API_TIMEOUT: 'api_timeout',
    API_AUTH_ERROR: 'auth_error',
    API_RATE_LIMIT: 'rate_limit',
    // Configuration issues
    CONFIG_ERROR: 'config_error',
    MISSING_TOKEN: 'missing_token',
    MISSING_API_KEY: 'missing_api_key',
    // GitHub issues
    GITHUB_API_ERROR: 'github_api_error',
    PR_COMMENT_FAILED: 'pr_comment_failed',
    // Hash calculation issues
    HASH_CALCULATION_ERROR: 'hash_calculation_error',
    FILE_NOT_FOUND: 'file_not_found',
    // General
    UNKNOWN_ERROR: 'unknown_error',
};
