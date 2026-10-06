const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = readFileSync(resolve(
  __dirname,
  "../../main/resources/META-INF/resources/browse/assets/browse.js"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = source.indexOf("\n}\n", start);
  assert.notEqual(end, -1, `${name} should end at a top-level brace`);
  return source.slice(start, end + 3);
}

function loadUploadHelpers(globals = {}) {
  const calls = [];
  const context = vm.createContext({
    currentSession: null,
    hasUploadPermission: () => false,
    pushBrowseRoute: (hash) => calls.push(["pushBrowseRoute", hash]),
    viewHash: (view) => `#browse/${view}`,
    switchView: (view) => calls.push(["switchView", view]),
    renderUpload: () => calls.push(["renderUpload"]),
    ensureUploadableRepositories: () => calls.push(["ensureUploadableRepositories"]),
    showRepositoryList: (sync) => calls.push(["showRepositoryList", sync]),
    ...globals,
  });
  vm.runInContext(
    ["uploadEmptyStateMessage", "canShowUploadNav", "showUpload"].map(extractFunction).join("\n")
      + "\nglobalThis.uploadEmptyStateMessage = uploadEmptyStateMessage;"
      + "\nglobalThis.canShowUploadNav = canShowUploadNav;"
      + "\nglobalThis.showUpload = showUpload;",
    context,
  );
  return { context, calls };
}

test("stays on the Upload page when a signed-in user has no uploadable repository", () => {
  const { context, calls } = loadUploadHelpers({
    currentSession: { userId: "admin" },
    hasUploadPermission: () => true,
  });

  context.showUpload();

  assert.deepEqual(calls.map(([name]) => name), [
    "pushBrowseRoute",
    "switchView",
    "renderUpload",
    "ensureUploadableRepositories",
  ]);
  assert.deepEqual(calls[1], ["switchView", "upload"]);
  assert.ok(!calls.some(([name]) => name === "showRepositoryList"));
});

test("shows the Upload page without changing the hash when restoring a route", () => {
  const { context, calls } = loadUploadHelpers({
    currentSession: { userId: "admin" },
    hasUploadPermission: () => true,
  });

  context.showUpload(false);

  assert.ok(!calls.some(([name]) => name === "pushBrowseRoute"));
  assert.deepEqual(calls[0], ["switchView", "upload"]);
});

test("still redirects anonymous visitors away from the Upload page", () => {
  const { context, calls } = loadUploadHelpers({ currentSession: null });

  context.showUpload();

  assert.deepEqual(calls, [["showRepositoryList", true]]);
});

test("only offers the Upload navigation to signed-in users with upload permission", () => {
  assert.equal(loadUploadHelpers().context.canShowUploadNav(), false);
  assert.equal(loadUploadHelpers({
    currentSession: { userId: "admin" },
    hasUploadPermission: () => false,
  }).context.canShowUploadNav(), false);
  assert.equal(loadUploadHelpers({
    currentSession: { userId: "admin" },
    hasUploadPermission: () => true,
  }).context.canShowUploadNav(), true);
});

test("explains why nothing can be uploaded", () => {
  const { context } = loadUploadHelpers();

  assert.match(context.uploadEmptyStateMessage(true), /No repository is available for web upload/);
  assert.match(context.uploadEmptyStateMessage(true), /docker push/);
  assert.match(context.uploadEmptyStateMessage(false), /do not have permission to upload/);
});

test("renders the empty-state message instead of an empty upload form", () => {
  const renderUpload = extractFunction("renderUpload");

  assert.match(renderUpload, /uploadRepos\.length === 0/);
  assert.match(renderUpload, /uploadEmptyStateMessage\(hasUploadPermission\(\)\)/);
  assert.match(renderUpload, /No repositories available/);
});
