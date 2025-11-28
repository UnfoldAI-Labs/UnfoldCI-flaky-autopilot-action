# Rate Limits and Error Handling

## Overview

UnfoldCI Flaky Test Autopilot is designed as a non-blocking observability tool. The action will never fail your CI pipeline due to rate limits or API errors.

## Behavior

### Rate Limiting

When usage limits are exceeded, the action succeeds with a warning and skips analysis for that run.

**Action Outputs:**
```yaml
flakes_detected: 0
tests_analyzed: 0
dashboard_url: ""
status: "rate_limited"
```

### API Errors

When the API is unavailable, the action succeeds with a warning and skips analysis.

**Action Outputs:**
```yaml
flakes_detected: 0
tests_analyzed: 0
dashboard_url: ""
status: "api_error"
```

## Usage Limits

| Plan | Tests/Month | PRs/Month |
|------|-------------|-----------|
| Beta | 300 | 15 |

## Monitoring Status

```yaml
- name: Analyze Flaky Tests
  id: flaky-analysis
  uses: UnfoldAI-Labs/UnfoldCI-flaky-autopilot-action@v1

- name: Check Status
  if: always()
  run: |
    echo "Status: ${{ steps.flaky-analysis.outputs.status }}"
```

## Support

- Issues: https://github.com/UnfoldAI-Labs/UnfoldCI-flaky-autopilot-action/issues
- Email: support@unfoldai.com
