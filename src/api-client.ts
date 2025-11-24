import { TestResult } from './parsers/junit';

interface SendResultsOptions {
  apiUrl: string;
  apiKey?: string;
  repoUrl: string;
  commitSha: string;
  testResults: TestResult[];
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
  const { apiUrl, apiKey, repoUrl, commitSha, testResults } = options;

  console.log(`📤 Sending ${testResults.length} test results to API...`);

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