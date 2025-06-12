# Publishing Guide for Typeberry

This guide explains how to publish Typeberry to npm, GitHub Packages, and GitHub Pages.

## Prerequisites

### 1. npm Authentication
```bash
npm login
```

### 2. GitHub Authentication (for GitHub Packages)
```bash
# Create a personal access token with packages:write scope
# Then login to GitHub registry
npm login --registry=https://npm.pkg.github.com
```

### 3. GitHub CLI (Optional but recommended)
```bash
# Install GitHub CLI for automated releases
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Login
gh auth login
```

## Publishing Methods

### 1. Automated Publishing (Recommended)

#### Using the Release Script
```bash
# Interactive release (will prompt for version type)
npm run release

# Release with specific version type
npm run release:patch  # 0.0.1 -> 0.0.2
npm run release:minor  # 0.0.1 -> 0.1.0
npm run release:major  # 0.0.1 -> 1.0.0

# Advanced options
./scripts/publish.sh --version 1.2.3 --skip-tests
./scripts/publish.sh --npm-only
./scripts/publish.sh --github-only
```

#### Using GitHub Actions (Tags)
```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# Or create a release through GitHub UI
# This will automatically trigger publishing
```

### 2. Manual Publishing

#### Build First
```bash
npm run build
```

#### Publish to npm
```bash
npm publish
```

#### Publish to GitHub Packages
```bash
# Temporarily modify package.json name
npm publish --registry=https://npm.pkg.github.com
```

#### Publish Both
```bash
npm run publish:both
```

## Publishing Targets

### 1. npm Registry
- **Package name**: `typeberry`
- **URL**: https://www.npmjs.com/package/typeberry
- **Installation**: `npm install -g typeberry`

### 2. GitHub Packages
- **Package name**: `@fluffylabs/typeberry`
- **URL**: https://github.com/fluffylabs/typeberry/packages
- **Installation**: `npm install -g @fluffylabs/typeberry`

### 3. GitHub Pages
- **URL**: https://fluffylabs.github.io/typeberry
- **Content**: Documentation + binary downloads
- **Updates**: Automatically on main branch push

## Release Process

### 1. Preparation
```bash
# Ensure working directory is clean
git status

# Run tests
npm test

# Run QA checks
npm run qa

# Build project
npm run build
```

### 2. Version Management
```bash
# Update version in package.json
npm version patch  # or minor, major
npm version 1.2.3  # specific version

# This creates a git commit and tag
```

### 3. Publishing
```bash
# Option A: Use release script
npm run release

# Option B: Manual steps
npm publish                                    # npm
npm publish --registry=https://npm.pkg.github.com  # GitHub
git push origin main --tags                   # Push changes
```

### 4. Post-Release
- Create GitHub release notes
- Update documentation
- Announce release

## GitHub Actions Workflows

### 1. Automated Publishing (`publish.yml`)
- **Trigger**: Git tags starting with `v`
- **Actions**: 
  - Build project
  - Run tests
  - Publish to npm
  - Publish to GitHub Packages
  - Deploy to GitHub Pages

### 2. GitHub Pages (`pages.yml`)
- **Trigger**: Push to main branch
- **Actions**:
  - Build project
  - Generate documentation site
  - Deploy to GitHub Pages

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```bash
# npm
npm login

# GitHub Packages
npm login --registry=https://npm.pkg.github.com
```

#### 2. Version Conflicts
```bash
# Check current version
npm view typeberry version

# Update version
npm version patch
```

#### 3. Build Issues
```bash
# Clean build
rm -rf dist/
npm run build

# Check for missing WASM files
ls -la dist/*.wasm
```

#### 4. Permission Errors
```bash
# Check npm permissions
npm access list packages @fluffylabs

# Check GitHub token permissions
gh auth status
```

### Debugging

#### Check Package Contents
```bash
# See what will be published
npm pack --dry-run

# Inspect tarball
npm pack
tar -tzf typeberry-*.tgz
```

**Note**: Source maps (`.map` files) are excluded from published packages to reduce size. They're only generated for local development and debugging.

#### Test Installation
```bash
# Test npm package
npm install -g typeberry@latest

# Test GitHub package
npm install -g @fluffylabs/typeberry@latest
```

#### Verify Binary
```bash
# After installation
typeberry --help

# Direct binary test
node dist/typeberry.cjs --help
```

## Best Practices

### 1. Version Management
- Use semantic versioning (semver)
- Update CHANGELOG.md
- Tag releases properly

### 2. Testing
- Always run tests before publishing
- Test installation on clean environment
- Verify binary functionality

### 3. Documentation
- Update README.md
- Keep GitHub Pages current
- Document breaking changes

### 4. Security
- Use npm 2FA for publishing
- Rotate GitHub tokens regularly
- Review package contents before publishing

### Configuration Files

### `.npmrc`
```ini
init-author-name="Fluffy Labs"
init-type="module"
init-license="MPL-2.0"
```

### `package.json` (Key fields)
```json
{
  "name": "typeberry",
  "private": false,
  "files": [
    "dist/typeberry.cjs",
    "dist/*.wasm",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

### `.npmignore`
Excludes development files from published package:
- Source maps (`*.map`)
- TypeScript source files
- Build configuration
- Development tools
- Test files

## Monitoring

### npm Stats
- Downloads: https://npm-stat.com/charts.html?package=typeberry
- Dependencies: https://npm.anvaka.com/#/view/2d/typeberry

### GitHub Stats
- Releases: https://github.com/fluffylabs/typeberry/releases
- Packages: https://github.com/fluffylabs/typeberry/packages

## Support

For publishing issues:
1. Check this guide
2. Review GitHub Actions logs
3. Check npm/GitHub status pages
4. Create issue in repository

---

**Note**: This guide assumes you have proper permissions to publish to the `typeberry` npm package and `@fluffylabs` GitHub organization.