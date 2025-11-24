"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestResults = sendTestResults;
async function sendTestResults(options) {
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
        const error = new Error(`API error: ${response.status} - ${errorText}`);
        error.status = response.status;
        error.responseBody = errorText;
        throw error;
    }
    return await response.json();
}
