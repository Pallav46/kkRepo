---
title: "Verify browse.js changes are served before UI testing"
created: "2026-10-06"
sessions: 1
developers: 1
paths: ["browse-ui/src/main/resources/META-INF/resources/browse/assets/browse.js"]
tags: ["assets", "build", "testing"]
---

# Verify browse.js changes are served before UI testing

After modifying browse.js, curl the actual served asset URL to verify the server has the updated code. Local edits and syntax checks do not guarantee deployment to the running server.

**Why:** Changes to source files aren't automatically reflected in served assets without rebuild, causing developers to test against stale code and get false-negative results.

**Evidence:** curl -s http://127.0.0.1:18090/browse/assets/browse.js | grep -c initSplitResizer returned 0 despite local changes to browse.js already passing node --check
