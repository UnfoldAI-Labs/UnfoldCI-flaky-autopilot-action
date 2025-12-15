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
  message?: string;
  usage_limit_exceeded?: boolean;
  upgrade_message?: string;
}

// Default patterns that cover most test frameworks
const DEFAULT_JUNIT_PATTERNS = [
  // Common conventions
  '**/test-results/**/*.xml',
  '**/test-reports/**/*.xml',
  
  // Standard JUnit output names
  '**/junit.xml',
  '**/junit-*.xml',
  '**/*-junit.xml',
  '**/junit-report.xml',
  
  // pytest
  '**/test-*.xml',
  '**/*_test.xml',
  '**/pytest-results.xml',
  
  // Jest
  '**/junitresults*.xml',
  '**/jest-junit.xml',
  
  // Maven Surefire
  '**/surefire-reports/*.xml',
  '**/surefire-reports/TEST-*.xml',
  
  // Gradle
  '**/build/test-results/**/*.xml',
  
  // Go
  '**/report.xml',
  
  // .NET / xUnit / NUnit
  '**/TestResults/*.xml',
  '**/*TestResults.xml',
  '**/xunit.xml',
  '**/nunit-results.xml',
  
  // Mocha
  '**/mocha-*.xml',
  '**/mocha-results.xml',
  
  // PHPUnit
  '**/phpunit-results.xml',
  
  // Generic
  '**/results.xml',
  '**/test-output/**/*.xml',
];

async function run() {
  // Store these for error reporting
  let apiUrl = 'https://api.unfoldci.com';
  let apiKey: string | undefined;
  let resultsPath = '**/test-results/**/*.xml';
  let errorAlreadyReported = false; // Track if we've already reported a specific error
  
  try {
    console.log('🚀 Flaky Test Autopilot - Starting');
    
    // Get inputs
    apiUrl = core.getInput('api-url') || 'https://api.unfoldci.com';
    apiKey = core.getInput('api-key');
    const customPath = core.getInput('results-path');
    resultsPath = customPath || DEFAULT_JUNIT_PATTERNS.join(',');
    const commentEnabled = core.getInput('comment-on-pr') === 'true';
    const failOnTestFailure = core.getInput('fail-on-test-failure') !== 'false'; // Default: true
    const minTests = parseInt(core.getInput('min-tests') || '0', 10);
    
    const context = github.context;
    const token = process.env.GITHUB_TOKEN;
    const hasGithubToken = !!token;
    
    if (!hasGithubToken) {
      // Show warning but continue execution
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════════════╗');
      console.log('║  ⚠️  WARNING: GITHUB_TOKEN not provided                          ║');
      console.log('╠══════════════════════════════════════════════════════════════════╣');
      console.log('║                                                                  ║');
      console.log('║  UnfoldCI will still collect test data and detect flaky tests.  ║');
      console.log('║                                                                  ║');
      console.log('║  However, these features require GITHUB_TOKEN:                   ║');
      console.log('║    • PR comments when flaky tests are detected                   ║');
      console.log('║    • Automatic fix PRs from AI analysis                          ║');
      console.log('║                                                                  ║');
      console.log('║  To enable all features, add to your workflow:                   ║');
      console.log('║                                                                  ║');
      console.log('║    env:                                                          ║');
      console.log('║      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}                  ║');
      console.log('║                                                                  ║');
      console.log('║  📚 Docs: https://docs.unfoldci.com/docs/configuration          ║');
      console.log('╚══════════════════════════════════════════════════════════════════╝');
      console.log('');
      
      // Report as informational telemetry (not error)
      await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.MISSING_TOKEN,
        error_message: 'GITHUB_TOKEN not provided. PR comments and auto-fix PRs disabled.',
        results_path: resultsPath,
      });
    }
    
    // Only create octokit if we have a token
    let octokit: ReturnType<typeof github.getOctokit> | null = null;
    if (hasGithubToken && token) {
      octokit = github.getOctokit(token);
    }
    
    // Get repo info - works with or without token
    let repoOwner: string;
    let repoName: string;
    
    try {
      repoOwner = context.repo.owner;
      repoName = context.repo.repo;
    } catch (e) {
      // Fallback to GITHUB_REPOSITORY env var
      const githubRepo = process.env.GITHUB_REPOSITORY || '';
      const [owner, repo] = githubRepo.split('/');
      repoOwner = owner || 'unknown';
      repoName = repo || 'unknown';
    }
    
    // Extract branch name - GITHUB_HEAD_REF is most reliable for PRs
    // For push events, extract from refs/heads/branch-name
    // For PR events, context.ref = refs/pull/123/merge which is NOT the branch name
    const branch = process.env.GITHUB_HEAD_REF  // PR source branch (set by GitHub Actions)
      || (context.ref?.startsWith('refs/heads/') ? context.ref.replace('refs/heads/', '') : '')
      || context.payload?.pull_request?.head?.ref 
      || '';
    
    console.log(`📊 Repo: ${repoOwner}/${repoName}`);
    console.log(`📝 Commit: ${context.sha || process.env.GITHUB_SHA || 'unknown'}`);
    console.log(`📌 Branch: ${branch || 'unknown'}`);
    
    // ✅ Early exit for fix branches - no need to send data to API
    // This saves API calls and prevents any possibility of polluting test stats
    if (branch.startsWith('flaky-autopilot/fix-')) {
      console.log(`⏭️  Skipping - this is a fix branch: ${branch}`);
      console.log(`   Fix PR branches should not affect original test statistics`);
      core.setOutput('status', 'skipped_fix_branch');
      core.setOutput('flakes_detected', 0);
      core.setOutput('tests_analyzed', 0);
      core.setOutput('tests_passed', 0);
      core.setOutput('tests_failed', 0);
      core.setOutput('tests_skipped', 0);
      core.setOutput('dashboard_url', '');
      core.setOutput('github_token_provided', hasGithubToken);
      return;
    }
    
    // Find test result files
    // Split patterns and glob each one, then dedupe
    const patterns = resultsPath.split(',').map(p => p.trim()).filter(Boolean);
    
    if (!customPath) {
      console.log(`🔍 Auto-detecting test results (checking ${patterns.length} common patterns)`);
    } else {
      console.log(`🔍 Finding test results: ${resultsPath}`);
    }
    
    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        ignore: ['**/node_modules/**', '**/.git/**'],
        absolute: true,
      });
      allFiles.push(...files);
    }
    
    // Dedupe files (same file might match multiple patterns)
    const resultFiles = [...new Set(allFiles)];
    
    if (resultFiles.length === 0) {
      console.log('⚠️  No test result files found');
      console.log('');
      console.log('   UnfoldCI looks for JUnit XML files in common locations.');
      console.log('   Make sure your test framework outputs JUnit XML format.');
      console.log('');
      console.log('   Common configurations:');
      console.log('   • Jest: npm install jest-junit, add --reporters=jest-junit');
      console.log('   • pytest: pytest --junitxml=test-results/junit.xml');
      console.log('   • Vitest: add junit reporter in vitest.config.ts');
      console.log('   • Go: go test -v 2>&1 | go-junit-report > report.xml');
      console.log('');
      console.log('   Or specify a custom path:');
      console.log('     results-path: "your/custom/path/**/*.xml"');
      console.log('');
      
      await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.XML_NOT_FOUND,
        error_message: `No test result files found matching pattern: ${resultsPath}`,
        results_path: resultsPath,
        files_found: 0,
        metadata: {
          search_pattern: resultsPath,
          patterns_checked: patterns.length,
          cwd: process.cwd(),
        },
      });
      core.setOutput('status', 'no_results');
      core.setOutput('flakes_detected', 0);
      core.setOutput('tests_analyzed', 0);
      core.setOutput('tests_passed', 0);
      core.setOutput('tests_failed', 0);
      core.setOutput('tests_skipped', 0);
      core.setOutput('dashboard_url', '');
      core.setOutput('github_token_provided', hasGithubToken);
      
      // Check min-tests requirement
      if (minTests > 0) {
        const message = `Expected at least ${minTests} tests, but found 0 (no test result files). Test runner may have crashed.`;
        console.log(`❌ ${message}`);
        core.setFailed(message);
      }
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
      core.setOutput('status', 'no_tests');
      core.setOutput('flakes_detected', 0);
      core.setOutput('tests_analyzed', 0);
      core.setOutput('tests_passed', 0);
      core.setOutput('tests_failed', 0);
      core.setOutput('tests_skipped', 0);
      core.setOutput('dashboard_url', '');
      core.setOutput('github_token_provided', hasGithubToken);
      
      // Check min-tests requirement
      if (minTests > 0) {
        const message = `Expected at least ${minTests} tests, but found 0 in result files. Test runner may have crashed.`;
        console.log(`❌ ${message}`);
        core.setFailed(message);
      }
      return;
    }
    
    // Check min-tests requirement
    if (allTests.length < minTests) {
      console.log(`⚠️  Found ${allTests.length} tests, but expected at least ${minTests}`);
    }
    
    // Count passed/failed/skipped tests
    // Note: 'error' outcomes (exceptions) should also fail CI, just like 'failed'
    const passedTests = allTests.filter(t => t.outcome === 'passed');
    const failedTests = allTests.filter(t => t.outcome === 'failed' || t.outcome === 'error');
    const skippedTests = allTests.filter(t => t.outcome === 'skipped');
    
    console.log('');
    console.log('📊 Test Results Summary:');
    console.log(`   ✅ Passed: ${passedTests.length}`);
    console.log(`   ❌ Failed: ${failedTests.length}`);
    if (skippedTests.length > 0) {
      console.log(`   ⏭️  Skipped: ${skippedTests.length}`);
    }
    
    if (failedTests.length > 0) {
      const failedNames = failedTests.map(t => t.name).join(', ');
      console.log(`   Failed tests: ${failedNames}`);
    }
    console.log('');
    
    console.log('📤 Sending results to Flaky Autopilot API...');

    let response: APIResponse | null = null;

    try {
      response = await sendTestResults({
        apiUrl,
        apiKey,
        repoUrl: `https://github.com/${repoOwner}/${repoName}`,
        commitSha: context.sha || process.env.GITHUB_SHA || 'unknown',
        testResults: allTests,
        triggeredBy: context.actor || process.env.GITHUB_ACTOR,
        branch: branch,
        hasGithubToken: hasGithubToken,
      }) as APIResponse;

      console.log(`✅ API Response:`, response);
      console.log(`   Flaky tests detected: ${response.flakes_detected || 0}`);

      // Show usage warning if limits exceeded (data was still saved)
      if (response.usage_limit_exceeded) {
        console.log('');
        console.log('📊 Usage Limit Notice:');
        console.log('   ✅ Test data has been saved to your dashboard');
        console.log('   ⏸️  AI analysis is paused (usage limit reached)');
        console.log('   💡 Your tests are still being tracked for flakiness detection');
        if (response.upgrade_message) {
          console.log(`   ℹ️  ${response.upgrade_message}`);
        }
        console.log('');
      }
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
        core.setOutput('tests_analyzed', allTests.length);
        core.setOutput('tests_passed', passedTests.length);
        core.setOutput('tests_failed', failedTests.length);
        core.setOutput('tests_skipped', skippedTests.length);
        core.setOutput('dashboard_url', '');
        core.setOutput('status', 'rate_limited');
        core.setOutput('github_token_provided', hasGithubToken);

        // Still fail CI if tests failed (API issues shouldn't hide test failures)
        if (failOnTestFailure && failedTests.length > 0) {
          const message = `${failedTests.length} test(s) failed or errored. See logs above for details.`;
          console.log('');
          console.log(`❌ ${message}`);
          core.setFailed(message);
        } else if (minTests > 0 && allTests.length < minTests) {
          const message = `Expected at least ${minTests} tests, but found ${allTests.length}. Test runner may have crashed.`;
          console.log(`❌ ${message}`);
          core.setFailed(message);
        }

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
      core.setOutput('tests_analyzed', allTests.length);
      core.setOutput('tests_passed', passedTests.length);
      core.setOutput('tests_failed', failedTests.length);
      core.setOutput('tests_skipped', skippedTests.length);
      core.setOutput('dashboard_url', '');
      core.setOutput('status', 'api_error');
      core.setOutput('github_token_provided', hasGithubToken);

      // Still fail CI if tests failed (API issues shouldn't hide test failures)
      if (failOnTestFailure && failedTests.length > 0) {
        const message = `${failedTests.length} test(s) failed or errored. See logs above for details.`;
        console.log('');
        console.log(`❌ ${message}`);
        core.setFailed(message);
      } else if (minTests > 0 && allTests.length < minTests) {
        const message = `Expected at least ${minTests} tests, but found ${allTests.length}. Test runner may have crashed.`;
        console.log(`❌ ${message}`);
        core.setFailed(message);
      }

      return;
    }

    core.setOutput('flakes_detected', response.flakes_detected || 0);
    core.setOutput('tests_analyzed', allTests.length);
    core.setOutput('tests_passed', passedTests.length);
    core.setOutput('tests_failed', failedTests.length);
    core.setOutput('tests_skipped', skippedTests.length);
    core.setOutput('dashboard_url', response.dashboard_url || '');
    core.setOutput('status', 'success');
    core.setOutput('github_token_provided', hasGithubToken);

    if (commentEnabled && hasGithubToken && octokit && context.payload.pull_request && (response.flakes_detected ?? 0) > 0) {
      console.log('💬 Creating PR comment...');

      try {
        await commentOnPR({
          octokit,
          owner: repoOwner,
          repo: repoName,
          prNumber: context.payload.pull_request.number,
          flakesDetected: response.flakes_detected ?? 0,
          apiUrl: response.dashboard_url || apiUrl,
        });

        console.log('✅ PR comment created');
      } catch (error: any) {
        console.warn('⚠️  Failed to create PR comment:', error.message);
      }
    } else if (commentEnabled && !hasGithubToken && context.payload.pull_request && (response.flakes_detected ?? 0) > 0) {
      console.log('ℹ️  PR comment skipped (GITHUB_TOKEN not provided)');
    }
    
    console.log('🎉 Flaky Test Autopilot - Complete!');
    
    // Fail CI if tests failed and option is enabled
    if (failOnTestFailure && failedTests.length > 0) {
      const message = `${failedTests.length} test(s) failed or errored. See logs above for details.`;
      console.log('');
      console.log(`❌ ${message}`);
      core.setFailed(message);
    } else if (minTests > 0 && allTests.length < minTests) {
      const message = `Expected at least ${minTests} tests, but found ${allTests.length}. Test runner may have crashed.`;
      console.log(`❌ ${message}`);
      core.setFailed(message);
    }
    
  } catch (error: any) {
    console.error('❌ Action failed:', error.message);
    console.error(error.stack);
    
    // Only report as UNKNOWN_ERROR if we haven't already reported it with a specific type
    // This prevents duplicate error reports (e.g., MISSING_TOKEN + UNKNOWN_ERROR)
    if (!errorAlreadyReported) {
      await reportError(apiUrl, apiKey, {
        error_type: ErrorTypes.UNKNOWN_ERROR,
        error_message: error.message,
        error_stack: error.stack,
        results_path: resultsPath,
      });
    }
    
    core.setFailed(error.message);
  }
}

run();