#!/bin/bash
# Vercel "Ignored Build Step" (vercel.json → ignoreCommand).
# Exit 0 = skip this build, exit 1 = build. Any doubt (unknown range, git error) → build.
#
# Saves build minutes on pushes that cannot change the deployed app: tests, e2e, docs,
# Markdown, CI config, Solidity sources and Foundry scripts. Dependabot previews are skipped
# too; their PRs still run CI, and merging them to main builds normally.

if [[ "$VERCEL_GIT_COMMIT_REF" == dependabot/* ]]; then
  echo "Skip: Dependabot preview"
  exit 0
fi

# Compare against the last deployed commit when Vercel provides it; otherwise the parent commit.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
if ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  echo "Build: base commit $BASE not available"
  exit 1
fi

git diff --quiet "$BASE" HEAD -- . \
  ':(exclude)test/**' \
  ':(exclude)e2e/**' \
  ':(exclude)docs/**' \
  ':(exclude)**/*.md' \
  ':(exclude)*.md' \
  ':(exclude).github/**' \
  ':(exclude)contracts/**' \
  ':(exclude)script/**' \
  ':(exclude)foundry.toml' \
  ':(exclude)remappings.txt' \
  ':(exclude)vitest.config.ts' \
  ':(exclude)vitest.fork.config.ts' \
  ':(exclude)playwright.config.ts'
status=$?
if [ $status -eq 0 ]; then
  echo "Skip: only tests/docs/contracts changed since $BASE"
  exit 0
fi
echo "Build: app files changed since $BASE"
exit 1
