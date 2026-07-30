#!/bin/bash
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
echo "Setting up branch protection for $REPO"

gh api "repos/$REPO/branches/main/protection" \
  --method PUT \
  --silent \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Validate application"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "✅ Branch protection enabled for main:"
echo "   - CI check 'Validate application' required"
echo "   - Strict status checks (branch must be up to date)"
echo "   - Admin enforcement enabled"
echo ""
echo "Auto-merge is now active: every PR that passes CI"
echo "without conflicts will be squash-merged automatically."
