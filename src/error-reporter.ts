import * as core from '@actions/core';
import * as github from '@actions/github';

const API_URL = process.env.UNFOLD_CI_API_URL || 'https://2ese0yds4a.execute-api.us-east-1.amazonaws.com';

export enum ErrorTypes {
  MISSING_TOKEN = 'missing_token',
  XML_NOT_FOUND = 'xml_not_found',
  XML_PARSE_ERROR = 'xml_parse_error',
  API_ERROR = 'api_error',
  API_RATE_LIMIT = 'api_rate_limit',
  UNKNOWN_ERROR = 'unknown_error',
}

interface ErrorReport {
  installation_id?: number;
  repo_name?: string;
  repo_owner?: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  action_version?: string;
  node_version?: string;
  runner_os?: string;
  workflow_name?: string;
  job_name?: string;
  run_id?: string;
  run_attempt?: string;
  results_path?: string;
  files_found?: number;
  test_framework?: string;
  metadata?: Record<string, any>;
}

/**
 * Safely get repo context - works even if GITHUB_TOKEN is missing
 * Uses multiple methods with fallbacks for maximum reliability
 */
function getRepoContext(): { owner: string; repo: string } {
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
      } else {
        core.debug(`[getRepoContext] Parse failed: owner="${owner}", repo="${repo}"`);
      }
    } else {
      core.debug(`[getRepoContext] GITHUB_REPOSITORY missing slash: "${githubRepository}"`);
    }
  } else {
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
  } catch (e: any) {
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
  } catch (e: any) {
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
export async function reportError(
  apiUrl: string,
  apiKey: string | undefined,
  errorData: {
    error_type: ErrorTypes | string;
    error_message: string;
    error_stack?: string;
    results_path?: string;
    files_found?: number;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const { owner, repo } = getRepoContext();
    
    const report: ErrorReport = {
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
    
    const headers: Record<string, string> = {
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
    } else {
      core.debug('[reportError] Error report sent successfully');
    }
  } catch (e: any) {
    // Don't fail the action if error reporting fails
    core.debug(`[reportError] Failed to send error report: ${e.message}`);
  }
}

/**
 * Report that GITHUB_TOKEN was not provided
 * This is a warning, not an error - action still works
 */
export async function reportMissingToken(apiUrl: string, apiKey: string | undefined): Promise<void> {
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
export async function reportApiError(
  apiUrl: string,
  apiKey: string | undefined,
  statusCode: number,
  responseBody: string,
  endpoint: string
): Promise<void> {
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
export async function reportNoFilesFound(
  apiUrl: string,
  apiKey: string | undefined,
  resultsPath: string,
  searchedPaths: string[]
): Promise<void> {
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
export async function reportParseError(
  apiUrl: string,
  apiKey: string | undefined,
  filePath: string,
  parseError: string
): Promise<void> {
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