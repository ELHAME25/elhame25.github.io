#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
node --check "$ROOT/assets/app.js"
node "$(dirname -- "$0")/qa-scope.js" "$ROOT"
node "$(dirname -- "$0")/qa-national-integrity.js" "$ROOT"
node "$(dirname -- "$0")/qa-company-coverage.js" "$ROOT"
node "$(dirname -- "$0")/qa-actions-markup.js" "$ROOT"
node "$(dirname -- "$0")/qa-ui-refinement.js" "$ROOT"
node "$(dirname -- "$0")/qa-ui-behavior.js" "$ROOT"
node "$(dirname -- "$0")/qa-context-phone.js" "$ROOT"
node "$ROOT/QA/companies-and-branch-radius.test.js" "$ROOT"
