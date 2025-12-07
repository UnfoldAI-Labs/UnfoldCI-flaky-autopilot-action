"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestResults = sendTestResults;
async function sendTestResults(options) {
    const { apiUrl, apiKey, repoUrl, commitSha, testResults, triggeredBy, branch } = options;
    console.log(`📤 Sending ${testResults.length} test results to API...`);
    if (branch) {
        console.log(`📌 Branch: ${branch}`);
    }
    // ✅ DEBUG: Log outcome distribution to help diagnose "all passed" bug
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
            triggered_by: triggeredBy, // GitHub username who triggered the CI
            branch: branch, // Branch name (used to filter out fix PR branches)
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
