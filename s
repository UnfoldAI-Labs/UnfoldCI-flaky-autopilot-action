[33mdd886ad[m[33m ([m[1;36mHEAD -> [m[1;32mRelease-V1.2.0[m[33m, [m[1;33mtag: v1[m[33m, [m[1;31morigin/Release-V1.2.0[m[33m)[m Rebuild with GITHUB_TOKEN error improvements
[1mdiff --git a/dist/error-reporter.js b/dist/error-reporter.js[m
[1mindex ea019d0..617389f 100644[m
[1m--- a/dist/error-reporter.js[m
[1m+++ b/dist/error-reporter.js[m
[36m@@ -40,6 +40,64 @@[m [mexports.ErrorTypes = void 0;[m
 exports.reportError = reportError;[m
 const github = __importStar(require("@actions/github"));[m
 const axios_1 = __importDefault(require("axios"));[m
[32m+[m[32m/**[m
[32m+[m[32m * Safely get repo context - works even if GITHUB_TOKEN is missing[m
[32m+[m[32m * Uses GITHUB_REPOSITORY env var as fallback[m
[32m+[m[32m */[m
[32m+[m[32mfunction getRepoContext() {[m
[32m+[m[32m    try {[m
[32m+[m[32m        // Try getting from @actions/github context first[m
[32m+[m[32m        const context = github.context;[m
[32m+[m[32m        if (context.repo?.owner && context.repo?.repo) {[m
[32m+[m[32m            return { owner: context.repo.owner, repo: context.repo.repo };[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m[32m    catch (e) {[m
[32m+[m[32m        // context.repo getter might throw if env vars are missing[m
[32m+[m[32m    }[m
[32m+[m[32m    // Fallback: parse GITHUB_REPOSITORY directly[m
[32m+[m[32m    // Format: "owner/repo" - always available in GitHub Actions[m
[32m+[m[32m    const githubRepo = process.env.GITHUB_REPOSITORY;[m
[32m+[m[32m    if (githubRepo) {[m
[32m+[m[32m        const [owner, repo] = githubRepo.split('/');[m
[32m+[m[32m        if (owner && repo) {[m
[32m+[m[32m            return { owner, repo };[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m[32m    // Last resort fallback[m
[32m+[m[32m    return { owner: 'unknown', repo: 'unknown' };[m
[32m+[m[32m}[m
[32m+[m[32m/**[m
[32m+[m[32m * Safely get workflow context[m
[32m+[m[32m */[m
[32m+[m[32mfunction getWorkflowContext() {[m
[32m+[m[32m    try {[m
[32m+[m[32m        const context = github.context;[m
[32m+[m[32m        return {[m
[32m+[m[32m            workflow: context.workflow,[m
[32m+[m[32m            job: context.job,[m
[32m+[m[32m            runId: context.runId?.toString(),[m
[32m+[m[32m            eventName: context.eventName,[m
[32m+[m[32m            ref: context.ref,[m
[32m+[m[32m            sha: context.sha,[m
[32m+[m[32m            actor: context.actor,[m
[32m+[m[32m            installationId: context.payload?.installation?.id,[m
[32m+[m[32m        };[m
[32m+[m[32m    }[m
[32m+[m[32m    catch (e) {[m
[32m+[m[32m        // Fallback to env vars[m
[32m+[m[32m        return {[m
[32m+[m[32m            workflow: process.env.GITHUB_WORKFLOW,[m
[32m+[m[32m            job: process.env.GITHUB_JOB,[m
[32m+[m[32m            runId: process.env.GITHUB_RUN_ID,[m
[32m+[m[32m            eventName: process.env.GITHUB_EVENT_NAME,[m
[32m+[m[32m            ref: process.env.GITHUB_REF,[m
[32m+[m[32m            sha: process.env.GITHUB_SHA,[m
[32m+[m[32m            actor: process.env.GITHUB_ACTOR,[m
[32m+[m[32m            installationId: undefined,[m
[32m+[m[32m        };[m
[32m+[m[32m    }[m
[32m+[m[32m}[m
 /**[m
  * Reports errors to the UnfoldCI API for telemetry and debugging.[m
  * This helps the UnfoldCI team understand what issues users face.[m
[36m@@ -47,12 +105,14 @@[m [mconst axios_1 = __importDefault(require("axios"));[m
  * Note: This is non-blocking and will not fail the action if reporting fails.[m
  */[m
 async function reportError(apiUrl, apiKey, error) {[m
[31m-    const context = github.context;[m
     try {[m
[32m+[m[32m        // ✅ Use defensive getters that won't throw[m
[32m+[m[32m        const repoContext = getRepoContext();[m
[32m+[m[32m        const workflowContext = getWorkflowContext();[m
         const payload = {[m
[31m-            installation_id: context.payload.installation?.id,[m
[31m-            repo_name: context.repo.repo,[m
[31m-            repo_owner: context.repo.owner,[m
[32m+[m[32m            installation_id: workflowContext.installationId,[m
[32m+[m[32m            repo_name: repoContext.repo,[m
[32m+[m[32m            repo_owner: repoContext.owner,[m
             // Error details[m
             error_type: error.error_type,[m
             error_message: error.error_message,[m
[36m@@ -61,9 +121,9 @@[m [masync function reportError(apiUrl, apiKey, error) {[m
             action_version: process.env.npm_package_version || '1.0.0',[m
             node_version: process.version,[m
             runner_os: process.env.RUNNER_OS || process.platform,[m
[31m-            workflow_name: context.workflow,[m
[31m-            job_name: context.job,[m
[31m-            run_id: context.runId?.toString(),[m
[32m+[m[32m            workflow_name: workflowContext.workflow,[m
[32m+[m[32m            job_name: workflowContext.job,[m
[32m+[m[32m            run_id: workflowContext.runId,[m
             run_attempt: parseInt(process.env.GITHUB_RUN_ATTEMPT || '1'),[m
             // Test framework info[m
             results_path: error.results_path,[m
[36m@@ -72,10 +132,10 @@[m [masync function reportError(apiUrl, apiKey, error) {[m
             // Additional metadata[m
             metadata: {[m
                 ...error.metadata,[m
[31m-                event_name: context.eventName,[m
[31m-                ref: context.ref,[m
[31m-                sha: context.sha,[m
[31m-                actor: context.actor,[m
[32m+[m[32m                event_name: workflowContext.eventName,[m
[32m+[m[32m                ref: workflowContext.ref,[m
[32m+[m[32m                sha: workflowContext.sha,[m
[32m+[m[32m                actor: workflowContext.actor,[m
             },[m
         };[m
         // Send to error reporting endpoint[m
[1mdiff --git a/dist/index.js b/dist/index.js[m
[1mindex a46fd16..3d903d0 100644[m
[1m--- a/dist/index.js[m
[1m+++ b/dist/index.js[m
[36m@@ -97,6 +97,64 @@[m [mexports.ErrorTypes = void 0;[m
 exports.reportError = reportError;[m
 const github = __importStar(__nccwpck_require__(3228));[m
 const axios_1 = __importDefault(__nccwpck_require__(7269));[m
[32m+[m[32m/**[m
[32m+[m[32m * Safely get repo context - works even if GITHUB_TOKEN is missing[m
[32m+[m[32m * Uses GITHUB_REPOSITORY env var as fallback[m
[32m+[m[32m */[m
[32m+[m[32mfunction getRepoContext() {[m
[32m+[m[32m    try {[m
[32m+[m[32m        // Try getting from @actions/github context first[m
[32m+[m[32m        const context = github.context;[m
[32m+[m[32m        if (context.repo?.owner && context.repo?.repo) {[m
[32m+[m[32m            return { owner: context.repo.owner, repo: context.repo.repo };[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m[32m    catch (e) {[m
[32m+[m[32m        // context.repo getter might throw if env vars are missing[m
[32m+[m[32m    }[m
[32m+[m[32m    // Fallback: parse GITHUB_REPOSITORY directly[m
[32m+[m[32m    // Format: "owner/repo" - always available in GitHub Actions[m
[32m+[m[32m    const githubRepo = process.env.GITHUB_REPOSITORY;[m
[32m+[m[32m    if (githubRepo) {[m
[32m+[m[32m        const [owner, repo] = githubRepo.split('/');[m
[32m+[m[32m        if (owner && repo) {[m
[32m+[m[32m            return { owner, repo };[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m[32m    // Last resort fallback[m
[32m+[m[32m    return { owner: 'unknown', repo: 'unknown' };[m
[32m+[m[32m}[m
[32m+[m[32m/**[m
[32m+[m[32m * Safely get workflow context[m
[32m+[m[32m */[m
[32m+[m[32mfunction getWorkflowContext() {[m
[32m+[m[32m    try {[m
[32m+[m[32m        const context = github.context;[m
[32m+[m[32m        return {[m
[32m+[m[32m            workflow: context.workflow,[m
[32m+[m[32m            job: context.job,[m
[32m+[m[32m            runId: context.runId?.toString(),[m
[32m+[m[32m            eventName: context.eventName,[m
[32m+[m[32m            ref: context.ref,[m
[32m+[m[32m            sha: context.sha,[m
[32m+[m[32m            actor: context.actor,[m
[32m+[m[32m            installationId: context.payload?.installation?.id,[m
[32m+[m[32m        };[m
[32m+[m[32m    }[m
[32m+[m[32m    catch (e) {[m
[32m+[m[32m        // Fallback to env vars[m
[32m+[m[32m        return {[m
[32m+[m[32m            workflow: process.env.GITHUB_WORKFLOW,[m
[32m+[m[32m            job: process.env.GITHUB_JOB,[m
[32m+[m[32m            runId: process.env.GITHUB_RUN_ID,[m
[32m+[m[32m            eventName: process.env.GITHUB_EVENT_NAME,[m
[32m+[m[32m            ref: process.env.GITHUB_REF,[m
[32m+[m[32m            sha: process.env.GITHUB_SHA,[m
[32m+[m[32m            actor: process.env.GITHUB_ACTOR,[m
[32m+[m[32m            installationId: undefined,[m
[32m+[m[32m        };[m
[32m+[m[32m    }[m
[32m+[m[32m}[m
 /**[m
  * Reports errors to the UnfoldCI API for telemetry and debugging.[m
  * This helps the UnfoldCI team understand what issues users face.[m
[36m@@ -104,12 +162,14 @@[m [mconst axios_1 = __importDefault(__nccwpck_require__(7269));[m
  * Note: This is non-blocking and will not fail the action if reporting fails.[m
  */[m
 async function reportError(apiUrl, apiKey, error) {[m
[31m-    const context = github.context;[m
     try {[m
[32m+[m[32m        // ✅ Use defensive getters that won't throw[m
[32m+[m[32m        const repoContext = getRepoContext();[m
[32m+[m[32m        const workflowContext = getWorkflowContext();[m
         const payload = {[m
[31m-            installation_id: context.payload.installation?.id,[m
[31m-            repo_name: context.repo.repo,[m
[31m-            repo_owner: context.repo.owner,[m
[32m+[m[32m            installation_id: workflowContext.installationId,[m
[32m+[m[32m            repo_name: repoContext.repo,[m
[32m+[m[32m            repo_owner: repoContext.owner,[m
             // Error details[m
             error_type: error.error_type,[m
             error_message: error.error_message,[m
[36m@@ -118,9 +178,9 @@[m [masync function reportError(apiUrl, apiKey, error) {[m
             action_version: process.env.npm_package_version || '1.0.0',[m
             node_version: process.version,[m
             runner_os: process.env.RUNNER_OS || process.platform,[m
[31m-            workflow_name: context.workflow,[m
[31m-            job_name: context.job,[m
[31m-            run_id: context.runId?.toString(),[m
[32m+[m[32m            workflow_name: workflowContext.workflow,[m
[32m+[m[32m            job_name: workflowContext.job,[m
[32m+[m[32m            run_id: workflowContext.runId,[m
             run_attempt: parseInt(process.env.GITHUB_RUN_ATTEMPT || '1'),[m
             // Test framework info[m
             results_path: error.results_path,[m
[36m@@ -129,10 +189,10 @@[m [masync function reportError(apiUrl, apiKey, error) {[m
             // Additional metadata[m
             metadata: {[m
                 ...error.metadata,[m
[31m-                event_name: context.eventName,[m
[31m-                ref: context.ref,[m
[31m-                sha: context.sha,[m
[31m-                actor: context.actor,[m
[32m+[m[32m                event_name: workflowContext.eventName,[m
[32m+[m[32m                ref: workflowContext.ref,[m
[32m+[m[32m                sha: workflowContext.sha,[m
[32m+[m[32m                actor: workflowContext.actor,[m
             },[m
         };[m
         // Send to error reporting endpoint[m
[36m@@ -233,6 +293,7 @@[m [masync function run() {[m
     let apiUrl = 'https://api.unfoldci.com';[m
     let apiKey;[m
     let resultsPath = '**/test-results/**/*.xml';[m
[32m+[m[32m    let errorAlreadyReported = false; // Track if we've already reported a specific error[m
     try {[m
         console.log('🚀 Flaky Test Autopilot - Starting');[m
         // Get inputs[m
[36m@@ -245,12 +306,42 @@[m [masync function run() {[m
         const context = github.context;[m
         const token = process.env.GITHUB_TOKEN;[m
         if (!token) {[m
[32m+[m[32m            // ✅ Show helpful error message in CI logs FIRST[m
[32m+[m[32m            console.error('');[m
[32m+[m[32m            console.error('╔══════════════════════════════════════════════════════════════════╗');[m
[32m+[m[32m            console.error('║  ❌ ERROR: GITHUB_TOKEN is required but not found               ║');[m
[32m+[m[32m            console.error('╠══════════════════════════════════════════════════════════════════╣');[m
[32m+[m[32m            console.error('║                                                                  ║');[m
[32m+[m[32m            console.error('║  Add this to your workflow step:                                 ║');[m
[32m+[m[32m            console.error('║                                                                  ║');[m
[32m+[m[32m            console.error('║    - uses: UnfoldAI-Labs/UnfoldCI-flaky-autopilot-action@v1     ║');[m
[32m+[m[32m            console.error('║      env:                                                        ║');[m
[32m+[m[32m            console.error('║        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}                ║');[m
[32m+[m[32m            console.error('║      with:                                                       ║');[m
[32m+[m[32m            console.error('║        api-key: ${{ secrets.FLAKY_AUTOPILOT_KEY }}              ║');[m
[32m+[m[32m            console.error('║                                                                  ║');[m
[32m+[m[32m            console.error('║  The GITHUB_TOKEN is provided automatically by GitHub Actions.  ║');[m
[32m+[m[32m            console.error('║  You just need to pass it to the action via the env block.      ║');[m
[32m+[m[32m            console.error('║                                                                  ║');[m
[32m+[m[32m            console.error('║  📚 Docs: https://docs.unfoldci.com/docs/configuration          ║');[m
[32m+[m[32m            console.error('╚══════════════════════════════════════════════════════════════════╝');[m
[32m+[m[32m            console.error('');[m
[32m+[m[32m            // Report error to telemetry (don't need to pass repo_owner - error-reporter handles it)[m
[32m+[m[32m            errorAlreadyReported = true;[m
             await (0, error_reporter_1.reportError)(apiUrl, apiKey, {[m
                 error_type: error_reporter_1.ErrorTypes.MISSING_TOKEN,[m
[31m-                error_message: 'GITHUB_TOKEN environment variable not found',[m
[32m+[m[32m                error_message: 'GITHUB_TOKEN environment variable not found. User needs to add env block to workflow.',[m
                 results_path: resultsPath,[m
             });[m
[31m-            throw new Error('GITHUB_TOKEN not found');[m
[32m+[m[32m            // Set outputs so downstream steps can check[m
[32m+[m[32m            core.setOutput('status', 'missing_token');[m
[32m+[m[32m            core.setOutput('flakes_detected', 0);[m
[32m+[m[32m            core.setOutput('tests_analyzed', 0);[m
[32m+[m[32m            core.setOutput('tests_passed', 0);[m
[32m+[m[32m            core.setOutput('tests_failed', 0);[m
[32m+[m[32m            core.setOutput('tests_skipped', 0);[m
[32m+[m[32m            core.setOutput('dashboard_url', '');[m
[32m+[m[32m            throw new Error('GITHUB_TOKEN not found. See error message above for fix.');[m
         }[m
         const octokit = github.getOctokit(token);[m
         // Extract branch name - GITHUB_HEAD_REF is most reliable for PRs[m
[36m@@ -534,13 +625,16 @@[m [masync function run() {[m
     catch (error) {[m
         console.error('❌ Action failed:', error.message);[m
         console.error(error.stack);[m
[31m-        // Report unexpected errors[m
[31m-        await (0, error_reporter_1.reportError)(apiUrl, apiKey, {[m
[31m-            error_type: error_reporter_1.ErrorTypes.UNKNOWN_ERROR,[m
[31m-            error_message: error.message,[m
[31m-            error_stack: error.stack,[m
[31m-            results_path: resultsPath,[m
[31m-        });[m
[32m+[m[32m        // Only report as UNKNOWN_ERROR if we haven't already reported it with a specific type[m
[32m+[m[32m        // This prevents duplicate error reports (e.g., MISSING_TOKEN + UNKNOWN_ERROR)[m
[32m+[m[32m        if (!errorAlreadyReported) {[m
[32m+[m[32m            await (0, error_reporter_1.reportError)(apiUrl, apiKey, {[m
[32m+[m[32m                error_type: error_reporter_1.ErrorTypes.UNKNOWN_ERROR,[m
[32m+[m[32m                error_message: error.message,[m
[32m+[m[32m                error_stack: error.stack,[m
[32m+[m[32m                results_path: resultsPath,[m
[32m+[m[32m            });[m
[32m+[m[32m        }[m
         core.setFailed(error.message);[m
     }[m
 }[m
