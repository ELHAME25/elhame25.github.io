#!/usr/bin/env node
"use strict";
const expectedSha = process.env.GITHUB_SHA || "unknown";
const base = "https://elhame25.github.io/riyad-opportunities/";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeout = 12000;
let last = "no response";
async function read(path) {
  const response = await fetch(base + path + "?liveCheck=" + Date.now(), {
    signal: AbortSignal.timeout(timeout),
    headers: { "cache-control": "no-cache" }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(path + " returned HTTP " + response.status);
  return body;
}
(async () => {
  for (let attempt = 1; attempt <= 24; attempt++) {
    try {
      const [html, app, branchesText, image] = await Promise.all([
        read(""),
        read("assets/app.js"),
        read("data/branches.json"),
        read("assets/images/real-estate-illustrative-apartments.svg")
      ]);
      const branches = JSON.parse(branchesText);
      const byCode = Object.fromEntries(branches.map(branch => [String(branch.c), branch]));
      const checks = {
        page: html.includes('id="app"') && html.includes("assets/app.js"),
        currentApp: app.includes("local_internal_reference") && app.includes("الفرع بلا دبوس مؤكد يعرض نطاق المدينة"),
        branchFallbacks: ["176", "307"].every(code => byCode[code] && byCode[code].lat == null && byCode[code].lon == null && byCode[code].distanceScope === "city"),
        centerLabels: ["397", "197"].every(code => byCode[code] && byCode[code].codeStatus === "local_internal_reference"),
        urbanFallbackImage: image.includes("<svg") && image.includes("مبانٍ سكنية")
      };
      if (Object.values(checks).every(Boolean)) {
        console.log(JSON.stringify({ ok: true, expectedSha, url: base, checks }, null, 2));
        return;
      }
      last = JSON.stringify(checks);
    } catch (error) {
      last = error.message;
    }
    console.log("Pages is not serving the expected commit yet (" + attempt + "/24): " + last);
    await wait(10000);
  }
  throw new Error("Live Pages verification failed for " + expectedSha + ": " + last);
})().catch(error => { console.error(error); process.exitCode = 1; });
