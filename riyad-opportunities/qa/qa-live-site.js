#!/usr/bin/env node
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto"), assert = require("assert");
const root = path.resolve(__dirname, "..");
const digest = text => crypto.createHash("sha256").update(text).digest("hex");
const files = ["index.html", "assets/app.js", "assets/app.css", "config/site.json", ...fs.readdirSync(path.join(root, "data")).filter(name => name.endsWith(".json")).sort().map(name => "data/" + name), "assets/images/real-estate-illustrative-apartments.svg"];
const expectedHashes = Object.fromEntries(files.map(file => [file, digest(fs.readFileSync(path.join(root, file)))]));
const expectedSha = process.env.GITHUB_SHA || "unknown";
const base = "https://elhame25.github.io/riyad-opportunities/";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeout = 12000;
let last = "no response";
async function read(file) {
  const response = await fetch(base + file + "?liveCheck=" + Date.now(), {
    signal: AbortSignal.timeout(timeout), headers: { "cache-control": "no-cache" }
  });
  if (!response.ok) throw new Error(file + " returned HTTP " + response.status);
  return response.text();
}
function evaluate(bodies) {
  const html = bodies["index.html"], app = bodies["assets/app.js"], image = bodies[files.at(-1)];
  const byCode = Object.fromEntries(JSON.parse(bodies["data/branches.json"]).map(branch => [String(branch.c), branch]));
  const branch176 = byCode["176"], branch307 = byCode["307"];
  const fileHashes = Object.fromEntries(files.map(file => [file, digest(bodies[file])]));
  const checks = {
    page: html.includes('id="app"') && html.includes("assets/app.js"),
    currentApp: digest(app) === expectedHashes["assets/app.js"],
    currentIndex: digest(html) === expectedHashes["index.html"],
    currentRuntimeAndData: files.every(file => fileHashes[file] === expectedHashes[file]),
    officialBranch176Pin: !!branch176 && branch176.city === "جدة" && branch176.lat === 21.55758 && branch176.lon === 39.20362 && branch176.officialMapStatus === "reviewed" && branch176.coordinateReview?.officialLocatorId === "1563" && branch176.coordinateReview?.officialBranchCode === "176" && branch176.coordinateSource === "https://www.riyadbank.com/ar/branches-atms" && branch176.distanceScope !== "city",
    missingBranch307Fallback: !!branch307 && branch307.lat == null && branch307.lon == null && branch307.distanceScope === "city" && branch307.officialMapStatus === "held",
    centerLabels: ["397", "197"].every(code => byCode[code] && byCode[code].codeStatus === "local_internal_reference"),
    urbanFallbackImage: image.includes("<svg") && image.includes("مبانٍ سكنية")
  };
  return { checks, fileHashes };
}
function selfTest() {
  const bodies = Object.fromEntries(files.map(file => [file, fs.readFileSync(path.join(root, file), "utf8")]));
  assert(Object.values(evaluate(bodies).checks).every(Boolean), "Candidate smoke contract must pass local exact bytes");
  for (const file of files) assert.equal(evaluate({ ...bodies, [file]: bodies[file] + "\n" }).checks.currentRuntimeAndData, false, "Changed bytes must fail: " + file);
  for (const [code, fields, check] of [["176", {lat:null,lon:null,distanceScope:"city"}, "officialBranch176Pin"], ["307", {lat:26.7,lon:50.0}, "missingBranch307Fallback"]]) {
    const branches = JSON.parse(bodies["data/branches.json"]); Object.assign(branches.find(b => String(b.c) === code), fields);
    assert.equal(evaluate({ ...bodies, "data/branches.json": JSON.stringify(branches) }).checks[check], false, "Obsolete/unsupported branch pin must fail: " + code);
  }
  console.log(JSON.stringify({ ok:true, selfTest:true, live:false, exactFiles:files.length, rejectedByteMutations:files.length, rejectedBranchMutations:2 }));
}
async function verifyLive() {
  for (let attempt = 1; attempt <= 24; attempt++) {
    try {
      const bodies = Object.fromEntries(await Promise.all(files.map(async file => [file, await read(file)])));
      const { checks, fileHashes } = evaluate(bodies);
      if (Object.values(checks).every(Boolean)) {
        console.log(JSON.stringify({ ok:true, expectedSha, url:base, checks, fileHashes }, null, 2)); return;
      }
      last = JSON.stringify(checks);
    } catch (error) { last = error.message; }
    console.log("Pages is not serving the expected commit yet (" + attempt + "/24): " + last);
    await wait(10000);
  }
  throw new Error("Live Pages verification failed for " + expectedSha + ": " + last);
}
(async () => { if (process.argv.includes("--self-test")) selfTest(); else await verifyLive(); })().catch(error => { console.error(error); process.exitCode = 1; });
