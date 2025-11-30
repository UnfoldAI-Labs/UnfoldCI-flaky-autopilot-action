import * as core from '@actions/core';
import * as github from '@actions/github';
import { glob } from 'glob';
import { parseJUnitXML } from './parsers/junit';
import { sendTestResults } from './api-client';
import { calculateFileHash } from './utils/hash';
import { calculateDependencyHash } from './utils/dependency-hash';
import { commentOnPR } from './pr-comment';
import { reportError, ErrorTypes } from './error-reporter';

// Add this interface at the top
interface APIResponse {
  success: boolean;
  ci_run_id?: string;
  flakes_detected?: number;
  flaky_tests?: Array<{
    name: string;
    file: string;
    pass_rate: number;
    analysis_url: string;
  }>;
  dashboard_url?: string;
}

async function run() {
  // Store these for error reporting
  let apiUrl = 'https://api.unfoldci.com';
  let apiKey: string | undefined;
  let resultsPath = '**/test-results/**/*.xml';
  
  try {
    console.log('🚀 Flaky Test Autopilot - Starting');
    
    // Get inputs
    apiUrl = core.getInput('api-url') || 'https://api.unfoldci.com';
    apiKey = core.getInput('api-key');
    resultsPath = core.getInput('results-path') || '**/test-results/**/*.xml';
    const commentEnabled = core.getInput('comment-on-pr') === 'true';
    
    const context = github.context;
    const token = process.env.GITHUB_TOKEN;
    
    if (!token) {
      await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.MISSING_TOKEN,
        error_message: 'GITHUB_TOKEN environment variable not found',
        results_path: resultsPath,
      });
      throw new Error('GITHUB_TOKEN not found');
    }
    
    const octokit = github.getOctokit(token);
    
    console.log(`📊 Repo: ${context.repo.owner}/${context.repo.repo}`);
    console.log(`📝 Commit: ${context.sha}`);
    
    // Find test result files
    console.log(`🔍 Finding test results: ${resultsPath}`);
    const resultFiles = await glob(resultsPath, { 
      ignore: ['**/node_modules/**'],
      absolute: true,
    });
    
    if (resultFiles.length === 0) {
      console.log('⚠️  No test result files found');
      await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.XML_NOT_FOUND,
        error_message: `No test result files found matching pattern: ${resultsPath}`,
        results_path: resultsPath,
        files_found: 0,
        metadata: {
          search_pattern: resultsPath,
          cwd: process.cwd(),
        },
      });
      core.setOutput('flakes_detected', 0);
      core.setOutput('tests_analyzed', 0);
      return;
    }
    
    console.log(`📦 Found ${resultFiles.length} test result file(s)`);
    
    // Parse all test results
    const allTests: any[] = [];
    
    let parseErrors: string[] = [];
    for (const file of resultFiles) {
      try {
        console.log(`  Parsing: ${file}`);
        const tests = await parseJUnitXML(file);

        // Calculate dependency hash for each test (test + imports)
        for (const test of tests) {
          console.log(`\n  🔍 Calculating dependency hash for: ${test.name}`);
          test.code_hash = await calculateDependencyHash(test.file);
        }

        allTests.push(...tests);
      } catch (error: any) {
        console.warn(`  ⚠️  Failed to parse ${file}:`, error.message);
        parseErrors.push(`${file}: ${error.message}`);
      }
    }
    
    // Report parsing errors if any
    if (parseErrors.length > 0) {
      await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.XML_PARSE_ERROR,
        error_message: `Failed to parse ${parseErrors.length} file(s)`,
        results_path: resultsPath,
        files_found: resultFiles.length,
        metadata: {
          parse_errors: parseErrors,
          successful_parses: allTests.length,
        },
      });
    }
    
    console.log(`✅ Parsed ${allTests.length} test(s)`);
    
    if (allTests.length === 0) {
      console.log('⚠️  No tests found in result files');
      core.setOutput('flakes_detected', 0);
      core.setOutput('tests_analyzed', 0);
      return;
    }
    
    console.log('📤 Sending results to Flaky Autopilot API...');

    let response: APIResponse | null = null;

    try {
      response = await sendTestResults({
        apiUrl,
        apiKey,
        repoUrl: `https://github.com/${context.repo.owner}/${context.repo.repo}`,
        commitSha: context.sha,
        testResults: allTests,
        triggeredBy: context.actor, // GitHub username who triggered the workflow
      }) as APIResponse;

      console.log(`✅ API Response:`, response);
      console.log(`   Flaky tests detected: ${response.flakes_detected || 0}`);
    } catch (error: any) {
      if (error.status === 429) {
        console.warn('⚠️  Usage limit exceeded - analysis skipped for this run');

        try {
          const errorData = JSON.parse(error.responseBody);
          if (errorData.usage) {
            console.warn(`📊 Usage: ${errorData.usage.testsAnalyzed}/${errorData.limits?.testsPerMonth || '?'} tests analyzed this month`);
          }
          if (errorData.upgrade_message) {
            console.warn(`💡 ${errorData.upgrade_message}`);
          }
        } catch {
          // Ignore parsing errors
        }

        // Report rate limit (useful for understanding usage patterns)
        await reportError(apiUrl, apiKey, {
          error_type: ErrorTypes.API_RATE_LIMIT,
          error_message: 'Usage limit exceeded',
          results_path: resultsPath,
          files_found: resultFiles.length,
          metadata: {
            tests_count: allTests.length,
          },
        });

        console.warn('ℹ️  Your CI pipeline will continue normally');
        console.warn('ℹ️  Visit your dashboard to manage your plan');

        core.setOutput('flakes_detected', 0);
        core.setOutput('tests_analyzed', 0);
        core.setOutput('dashboard_url', '');
        core.setOutput('status', 'rate_limited');

        return;
      }

      // Report API errors
      await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.API_ERROR,
        error_message: error.message,
        error_stack: error.stack,
        results_path: resultsPath,
        files_found: resultFiles.length,
        metadata: {
          tests_count: allTests.length,
          status_code: error.status || error.response?.status,
          response_body: error.responseBody || error.response?.data,
        },
      });

      console.warn('⚠️  Failed to send results to API:', error.message);
      console.warn('ℹ️  Your CI pipeline will continue normally');

      core.setOutput('flakes_detected', 0);
      core.setOutput('tests_analyzed', 0);
      core.setOutput('dashboard_url', '');
      core.setOutput('status', 'api_error');

      return;
    }

    core.setOutput('flakes_detected', response.flakes_detected || 0);
    core.setOutput('tests_analyzed', allTests.length);
    core.setOutput('dashboard_url', response.dashboard_url || '');
    core.setOutput('status', 'success');

    if (commentEnabled && context.payload.pull_request && (response.flakes_detected ?? 0) > 0) {
      console.log('💬 Creating PR comment...');

      try {
        await commentOnPR({
          octokit,
          owner: context.repo.owner,
          repo: context.repo.repo,
          prNumber: context.payload.pull_request.number,
          flakesDetected: response.flakes_detected ?? 0,
          apiUrl: response.dashboard_url || apiUrl,
        });

        console.log('✅ PR comment created');
      } catch (error: any) {
        console.warn('⚠️  Failed to create PR comment:', error.message);
      }
    }
    
    console.log('🎉 Flaky Test Autopilot - Complete!');
    
  } catch (error: any) {
    console.error('❌ Action failed:', error.message);
    console.error(error.stack);
    
    // Report unexpected errors
    await reportError(apiUrl, apiKey, {
      error_type: ErrorTypes.UNKNOWN_ERROR,
      error_message: error.message,
      error_stack: error.stack,
      results_path: resultsPath,
    });
    
    core.setFailed(error.message);
  }
}

run();