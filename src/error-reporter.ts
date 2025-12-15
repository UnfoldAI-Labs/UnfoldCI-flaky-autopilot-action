import * as github from '@actions/github';
import axios from 'axios';

interface ErrorReport {
  error_type: string;
  error_message: string;
  error_stack?: string;
  results_path?: string;
  files_found?: number;
  test_framework?: string;
  metadata?: Record<string, any>;
}

/**
 * Safely get repo context - works even if GITHUB_TOKEN is missing
 * Uses GITHUB_REPOSITORY env var as fallback
 */
function getRepoContext(): { owner: string; repo: string } {
  // ✅ DEBUG: Log what we're seeing
  console.log('🔍 Debug: Getting repo context...');
  console.log(`   GITHUB_REPOSITORY env: "${process.env.GITHUB_REPOSITORY || '(not set)'}"`);
  
  try {
    // Try getting from @actions/github context first
    const context = github.context;
    console.log(`   github.context.repo: ${JSON.stringify(context.repo || '(undefined)')}`);
    
    if (context.repo?.owner && context.repo?.repo) {
      console.log(`   ✅ Using github.context: ${context.repo.owner}/${context.repo.repo}`);
      return { owner: context.repo.owner, repo: context.repo.repo };
    }
  } catch (e: any) {
    // context.repo getter might throw if env vars are missing
    console.log(`   ⚠️ github.context.repo threw: ${e.message}`);
  }
  
  // Fallback: parse GITHUB_REPOSITORY directly
  // Format: "owner/repo" - always available in GitHub Actions
  const githubRepo = process.env.GITHUB_REPOSITORY;
  if (githubRepo) {
    const parts = githubRepo.split('/');
    console.log(`   Parsed GITHUB_REPOSITORY: ${JSON.stringify(parts)}`);
    
    if (parts.length >= 2 && parts[0] && parts[1]) {
      console.log(`   ✅ Using GITHUB_REPOSITORY fallback: ${parts[0]}/${parts[1]}`);
      return { owner: parts[0], repo: parts[1] };
    }
  }
  
  // Last resort fallback
  console.log('   ❌ Could not determine repo - returning unknown/unknown');
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
  } catch (e) {
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
export async function reportError(
  apiUrl: string,
  apiKey: string | undefined,
  error: ErrorReport
): Promise<void> {
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
      },
    };

    // Send to error reporting endpoint
    const endpoint = `${apiUrl}/api/webhooks/error-report`;
    
    await axios.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      timeout: 5000, // 5 second timeout - don't slow down the action
    });

    console.log('📊 Error reported to UnfoldCI for analysis');
  } catch (reportingError: any) {
    // Silently fail - we don't want error reporting to break the action
    console.log('ℹ️  Could not report error telemetry (non-critical)');
  }
}

/**
 * Error types for categorization
 */
export const ErrorTypes = {
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
} as const;