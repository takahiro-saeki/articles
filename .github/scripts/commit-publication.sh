#!/usr/bin/env bash
set -euo pipefail
git add articles public devto schedule/publication-state.json
if git diff --cached --quiet; then exit 0; fi
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git commit -m 'Record scheduled publication state'
git push
