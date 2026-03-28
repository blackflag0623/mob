#!/usr/bin/env bash
# Publish mob-coordinator to npm
# Usage: ./scripts/publish.sh
#
# Checks auth, ensures clean build, and publishes.
# Run from the repo root.

set -euo pipefail

# Must be run from repo root
if [ ! -f package.json ]; then
  echo "Error: run from the repo root" >&2
  exit 1
fi

# Check npm auth
echo "Checking npm auth..."
if ! npm whoami &>/dev/null; then
  echo "Not logged in to npm. Run 'npm login' first." >&2
  exit 1
fi
echo "Logged in as: $(npm whoami)"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: uncommitted changes. Commit or stash first." >&2
  git status --short
  exit 1
fi

# Read version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Publishing mob-coordinator@${VERSION}"

# Publish (prepublishOnly in package.json handles the build)
# Pass through any extra args (e.g. --otp=123456)
echo "Publishing to npm..."
npm publish "$@"

echo ""
echo "Published mob-coordinator@${VERSION}"
echo "https://www.npmjs.com/package/mob-coordinator"
