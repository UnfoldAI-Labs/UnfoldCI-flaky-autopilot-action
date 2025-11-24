"use strict";
/**
 * PR Commenting - Notify users of flaky tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentOnPR = commentOnPR;
async function commentOnPR(options) {
    const { octokit, owner, repo, prNumber, flakesDetected, apiUrl } = options;
    const dashboardUrl = apiUrl.replace('http://localhost:3000', 'https://app.flakyautopilot.dev');
    const comment = `## 🤖 Flaky Test Autopilot

**Found ${flakesDetected} flaky test${flakesDetected > 1 ? 's' : ''}** in this PR

These tests fail intermittently and may cause CI instability.

### What's Next:
- View detailed analysis in your [dashboard](${dashboardUrl})
- AI is analyzing root causes
- PRs with fixes will be created automatically for fixable issues

### Need Help?
Flaky tests detected will be analyzed and fixed automatically. Check your repo for incoming PRs with AI-generated fixes!

---
<sub>Powered by [Flaky Test Autopilot](https://unfoldci.com)</sub>
`;
    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment,
    });
}
