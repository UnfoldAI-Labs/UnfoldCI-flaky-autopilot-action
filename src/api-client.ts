import { TestResult } from './parsers/junit';

interface SendResultsOptions {
  apiUrl: string;
  apiKey?: string;
  repoUrl: string;
  commitSha: string;
  testResults: TestResult[];
  triggeredBy?: string;
  branch?: string;
}

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

export async function sendTestResults(options: SendResultsOptions): Promise<APIResponse> {
  const { apiUrl, apiKey, repoUrl, commitSha, testResults, triggeredBy, branch } = options;

  console.log(`📤 Sending ${testResults.length} test results to API...`);
  if (branch) {
    console.log(`📌 Branch: ${branch}`);
  }

  // Debug: Log outcome distribution
  const passedCount = testResults.filter(t => t.outcome === 'passed').length;
  const failedCount = testResults.filter(t => t.outcome === 'failed').length;
  console.log(`📊 Test Results Summary:`);
  console.log(`   ✅ Passed: ${passedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  if (failedCount > 0) {
    console.log(`   Failed tests: ${testResults.filter(t => t.outcome === 'failed').map(t => t.name).join(', ')}`);
  }

  const response = await fetch(`${apiUrl}/api/webhooks/github`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      repo_url: repoUrl,
      commit_sha: commitSha,
      test_results: testResults,
      source: 'github_action',
      triggered_by: triggeredBy,
      branch: branch,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error: any = new Error(`API error: ${response.status} - ${errorText}`);
    error.status = response.status;
    error.responseBody = errorText;
    throw error;
  }

  return await response.json() as APIResponse;
}