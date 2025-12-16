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
exports.ErrorTypes = void 0;
exports.reportError = reportError;
exports.reportMissingToken = reportMissingToken;
exports.reportApiError = reportApiError;
exports.reportNoFilesFound = reportNoFilesFound;
exports.reportParseError = reportParseError;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const API_URL = process.env.UNFOLD_CI_API_URL || 'https://2ese0yds4a.execute-api.us-east-1.amazonaws.com';
var ErrorTypes;
(function (ErrorTypes) {
    ErrorTypes["MISSING_TOKEN"] = "missing_token";
    ErrorTypes["XML_NOT_FOUND"] = "xml_not_found";
    ErrorTypes["XML_PARSE_ERROR"] = "xml_parse_error";
    ErrorTypes["API_ERROR"] = "api_error";
    ErrorTypes["API_RATE_LIMIT"] = "api_rate_limit";
    ErrorTypes["UNKNOWN_ERROR"] = "unknown_error";
})(ErrorTypes || (exports.ErrorTypes = ErrorTypes = {}));
/**
 * Safely get repo context - works even if GITHUB_TOKEN is missing
 * Uses multiple methods with fallbacks for maximum reliability
 */
function getRepoContext() {
    // ============================================
    // Method 1: GITHUB_REPOSITORY env var (MOST RELIABLE)
    // This is ALWAYS set by GitHub Actions, regardless of GITHUB_TOKEN
    // Format: "owner/repo" (e.g., "octocat/hello-world")
    // ============================================
    const githubRepository = process.env.GITHUB_REPOSITORY;
    if (githubRepository) {
        core.debug(`[getRepoContext] GITHUB_REPOSITORY = "${githubRepository}"`);
        if (githubRepository.includes('/')) {
            const slashIndex = githubRepository.indexOf('/');
            const owner = githubRepository.substring(0, slashIndex).trim();
            const repo = githubRepository.substring(slashIndex + 1).trim();
            if (owner.length > 0 && repo.length > 0) {
                core.debug(`[getRepoContext] Parsed: owner="${owner}", repo="${repo}"`);
                return { owner, repo };
            }
            else {
                core.debug(`[getRepoContext] Parse failed: owner="${owner}", repo="${repo}"`);
            }
        }
        else {
            core.debug(`[getRepoContext] GITHUB_REPOSITORY missing slash: "${githubRepository}"`);
        }
    }
    else {
        core.debug('[getRepoContext] GITHUB_REPOSITORY is undefined or empty');
    }
    // ============================================
    // Method 2: @actions/github context
    // This internally reads GITHUB_REPOSITORY but may throw if malformed
    // ============================================
    try {
        const context = github.context;
        // context.repo is a getter that parses GITHUB_REPOSITORY
        // It can throw if the env var is missing or malformed
        const repoData = context.repo;
        if (repoData &&
            typeof repoData.owner === 'string' && repoData.owner.length > 0 &&
            typeof repoData.repo === 'string' && repoData.repo.length > 0) {
            core.debug(`[getRepoContext] From github.context: owner="${repoData.owner}", repo="${repoData.repo}"`);
            return { owner: repoData.owner, repo: repoData.repo };
        }
    }
    catch (e) {
        core.debug(`[getRepoContext] github.context.repo threw: ${e.message}`);
    }
    // ============================================
    // Method 3: Parse from GITHUB_EVENT_PATH payload
    // The event payload often contains repository info
    // ============================================
    try {
        const eventPath = process.env.GITHUB_EVENT_PATH;
        if (eventPath) {
            const fs = require('fs');
            if (fs.existsSync(eventPath)) {
                const eventPayload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
                const repository = eventPayload.repository;
                if (repository) {
                    // Try full_name first (e.g., "owner/repo")
                    if (repository.full_name && repository.full_name.includes('/')) {
                        const [owner, repo] = repository.full_name.split('/');
                        if (owner && repo) {
                            core.debug(`[getRepoContext] From event payload full_name: owner="${owner}", repo="${repo}"`);
                            return { owner, repo };
                        }
                    }
                    // Try owner.login + name
                    if (repository.owner?.login && repository.name) {
                        core.debug(`[getRepoContext] From event payload owner/name: owner="${repository.owner.login}", repo="${repository.name}"`);
                        return { owner: repository.owner.login, repo: repository.name };
                    }
                }
            }
        }
    }
    catch (e) {
        core.debug(`[getRepoContext] Event payload parse failed: ${e.message}`);
    }
    // ============================================
    // Method 4: GITHUB_REPOSITORY_OWNER + guess repo from URL
    // Partial fallback - at least get the owner
    // ============================================
    const repoOwner = process.env.GITHUB_REPOSITORY_OWNER;
    if (repoOwner && repoOwner.length > 0) {
        core.debug(`[getRepoContext] Partial: GITHUB_REPOSITORY_OWNER="${repoOwner}"`);
        // We have owner but not repo - still better than unknown/unknown
        return { owner: repoOwner, repo: 'unknown' };
    }
    // ============================================
    // Final fallback
    // ============================================
    core.warning('[getRepoContext] Could not determine repository context from any method');
    core.debug(`[getRepoContext] Environment dump: GITHUB_REPOSITORY="${process.env.GITHUB_REPOSITORY}", GITHUB_REPOSITORY_OWNER="${process.env.GITHUB_REPOSITORY_OWNER}"`);
    return { owner: 'unknown', repo: 'unknown' };
}
/**
 * Report an error to the UnfoldCI backend for telemetry
 * This helps identify common issues across users
 */
async function reportError(apiUrl, apiKey, errorData) {
    try {
        const { owner, repo } = getRepoContext();
        const report = {
            repo_owner: owner,
            repo_name: repo,
            error_type: errorData.error_type,
            error_message: errorData.error_message,
            error_stack: errorData.error_stack,
            results_path: errorData.results_path,
            files_found: errorData.files_found,
            action_version: process.env.ACTION_VERSION || 'unknown',
            node_version: process.version,
            runner_os: process.env.RUNNER_OS,
            workflow_name: process.env.GITHUB_WORKFLOW,
            job_name: process.env.GITHUB_JOB,
            run_id: process.env.GITHUB_RUN_ID,
            run_attempt: process.env.GITHUB_RUN_ATTEMPT,
            metadata: {
                ...errorData.metadata,
                debug_github_repository: process.env.GITHUB_REPOSITORY || 'NOT_SET',
                debug_github_repository_owner: process.env.GITHUB_REPOSITORY_OWNER || 'NOT_SET',
                debug_github_token_present: !!process.env.GITHUB_TOKEN,
                debug_context_method_used: owner !== 'unknown' ? 'success' : 'fallback',
            },
        };
        core.debug(`[reportError] Sending error report: type=${errorData.error_type}, repo=${owner}/${repo}`);
        // Use the provided apiUrl if available, otherwise fall back to default
        const errorReportUrl = apiUrl ? `${apiUrl}/api/webhooks/error-report` : `${API_URL}/api/webhooks/error-report`;
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'UnfoldCI-Action/1.0',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const response = await fetch(errorReportUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(report),
        });
        if (!response.ok) {
            core.debug(`[reportError] Backend returned ${response.status}: ${await response.text()}`);
        }
        else {
            core.debug('[reportError] Error report sent successfully');
        }
    }
    catch (e) {
        // Don't fail the action if error reporting fails
        core.debug(`[reportError] Failed to send error report: ${e.message}`);
    }
}
/**
 * Report that GITHUB_TOKEN was not provided
 * This is a warning, not an error - action still works
 */
async function reportMissingToken(apiUrl, apiKey) {
    await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.MISSING_TOKEN,
        error_message: 'GITHUB_TOKEN not provided. PR comments and auto-fix PRs disabled.',
        metadata: {
            severity: 'warning',
            user_action_required: 'Add GITHUB_TOKEN to env for full functionality',
        },
    });
}
/**
 * Report an API error (e.g., backend returned 5xx)
 */
async function reportApiError(apiUrl, apiKey, statusCode, responseBody, endpoint) {
    await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.API_ERROR,
        error_message: `API error: ${statusCode} - ${responseBody.substring(0, 500)}`,
        metadata: {
            status_code: statusCode,
            endpoint: endpoint,
            response_preview: responseBody.substring(0, 200),
        },
    });
}
/**
 * Report no test files found
 */
async function reportNoFilesFound(apiUrl, apiKey, resultsPath, searchedPaths) {
    await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.XML_NOT_FOUND,
        error_message: `No test result files found matching pattern: ${resultsPath}`,
        results_path: resultsPath,
        files_found: 0,
        metadata: {
            searched_paths: searchedPaths.slice(0, 10), // Limit to first 10
            severity: 'warning',
        },
    });
}
/**
 * Report XML parse error
 */
async function reportParseError(apiUrl, apiKey, filePath, parseError) {
    await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.XML_PARSE_ERROR,
        error_message: `Failed to parse test results file: ${filePath}`,
        metadata: {
            file_path: filePath,
            parse_error: parseError.substring(0, 500),
            severity: 'error',
        },
    });
}
