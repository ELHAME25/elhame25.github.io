#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
node --check "$ROOT/assets/app.js"
node "$ROOT/qa/qa-scope.js" "$ROOT"
node "$ROOT/qa/qa-company-coverage.js" "$ROOT"
node "$ROOT/qa/qa-actions-markup.js" "$ROOT"
node "$ROOT/qa/qa-ui-refinement.js" "$ROOT"
node "$ROOT/qa/qa-ui-behavior.js" "$ROOT"
node "$ROOT/qa/qa-context-phone.js" "$ROOT"
node "$ROOT/QA/companies-and-branch-radius.test.js" "$ROOT"
python3 "$ROOT/qa/test_final_guidance.py"
