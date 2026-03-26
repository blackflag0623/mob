// Checks for missing platform-specific native dependencies and installs them.
// npm has a known bug (https://github.com/npm/cli/issues/4828) where optional
// native binaries sometimes fail to install. This script runs after `npm install`
// to detect and fix that.

const { execSync } = require('child_process');
const path = require('path');

const toInstall = [];

// Check @lydell/node-pty native binary
const ptyPlatformPkg = `@lydell/node-pty-${process.platform}-${process.arch}`;
try {
  require.resolve(`${ptyPlatformPkg}/conpty.node`);
} catch {
  try {
    // Get the version that @lydell/node-pty expects
    const ptyPkg = require('@lydell/node-pty/package.json');
    const version = ptyPkg.optionalDependencies?.[ptyPlatformPkg];
    if (version) {
      toInstall.push(`${ptyPlatformPkg}@${version}`);
    }
  } catch {
    // @lydell/node-pty itself not installed yet, skip
  }
}

// Check rollup native binary
try {
  require.resolve('rollup/dist/native.js');
  // If it resolves, try actually loading it to see if the native module works
  require('rollup/dist/native.js');
} catch (e) {
  if (e.message && e.message.includes('rollup')) {
    try {
      const rollupPkg = require('rollup/package.json');
      const optDeps = rollupPkg.optionalDependencies || {};
      // Find the matching native package for this platform+arch
      // On Windows, prefer msvc over gnu
      const candidates = Object.keys(optDeps).filter(k =>
        k.startsWith('@rollup/rollup-') &&
        k.includes(process.platform) &&
        k.includes(process.arch)
      );
      const match = candidates.find(k => k.includes('msvc')) || candidates[0];
      if (match) {
        toInstall.push(`${match}@${optDeps[match]}`);
      }
    } catch {
      // rollup itself not installed yet, skip
    }
  }
}

if (toInstall.length > 0) {
  console.log(`\nInstalling missing native dependencies: ${toInstall.join(', ')}`);
  try {
    execSync(`npm install --no-save ${toInstall.join(' ')}`, {
      stdio: 'inherit',
      env: { ...process.env, npm_config_ignore_scripts: 'true' },
    });
    console.log('Native dependencies installed successfully.\n');
  } catch (err) {
    console.error('\nFailed to auto-install native dependencies.');
    console.error('Try manually: npm install ' + toInstall.join(' '));
    console.error('');
  }
}
