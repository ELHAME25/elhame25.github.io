# Independent geographic behavior regression tests

These tests use fixed source-reviewed membership fixtures, not application QA output as the expected result. Public neighborhood coordinates are fixtures, not user locations or municipality boundaries. Offline tests simulate the DOM; browser tests serve the unmodified candidate over loopback, block external requests and reject files changing during the run. They do not certify every source URL or business.

Run from the project directory:

    node qa/semantic/geography-data-contract.js . /tmp/geography-data.json
    node qa/semantic/semantic-contract.js . /tmp/semantic-offline.json
    SEMANTIC_BROWSER=chromium node qa/semantic/browser-semantic-contract.js . /tmp/semantic-chromium.json
    SEMANTIC_BROWSER=webkit node qa/semantic/browser-semantic-contract.js . /tmp/semantic-webkit.json

Playwright browsers must already be installed. Browser failures include screenshots beside the output report.
