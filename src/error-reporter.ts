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
  const context = github.context;
  
  try {
    const payload = {
      installation_id: context.payload.installation?.id,
      repo_name: context.repo.repo,
      repo_owner: context.repo.owner,
      
      // Error details
      error_type: error.error_type,
      error_message: error.error_message,
      error_stack: error.error_stack,
      
      // Context
      action_version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      runner_os: process.env.RUNNER_OS || process.platform,
      workflow_name: context.workflow,
      job_name: context.job,
      run_id: context.runId?.toString(),
      run_attempt: parseInt(process.env.GITHUB_RUN_ATTEMPT || '1'),
      
      // Test framework info
      results_path: error.results_path,
      files_found: error.files_found,
      test_framework: error.test_framework,
      
      // Additional metadata
      metadata: {
        ...error.metadata,
        event_name: context.eventName,
        ref: context.ref,
        sha: context.sha,
        actor: context.actor,
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

