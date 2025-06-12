#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if user is logged in to npm
check_npm_auth() {
    if ! npm whoami >/dev/null 2>&1; then
        print_error "You are not logged in to npm. Please run 'npm login' first."
        exit 1
    fi
    print_success "Authenticated with npm as $(npm whoami)"
}

# Function to check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
}

# Function to check for uncommitted changes
check_clean_working_tree() {
    if ! git diff-index --quiet HEAD --; then
        print_warning "You have uncommitted changes. It's recommended to commit them first."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to run tests and checks
run_tests() {
    print_status "Running tests..."
    npm test

    print_status "Running QA checks..."
    npm run qa

    print_success "All tests and checks passed"
}

# Function to build the project
build_project() {
    print_status "Building project..."
    npm run build
    print_success "Build completed"
}

# Function to update version
update_version() {
    local version_type="$1"

    if [[ -z "$version_type" ]]; then
        echo "Current version: $(node -p "require('./package.json').version")"
        echo "Available version types: patch, minor, major, prerelease"
        read -p "Enter version type (or specific version like 1.2.3): " version_type
    fi

    if [[ "$version_type" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        # Specific version provided
        npm version "$version_type" --no-git-tag-version
    else
        # Version type provided (patch, minor, major, etc.)
        npm version "$version_type" --no-git-tag-version
    fi

    local new_version=$(node -p "require('./package.json').version")
    print_success "Version updated to $new_version"

    # Commit version change
    git add package.json
    git commit -m "chore: bump version to $new_version"

    # Create tag
    git tag "v$new_version"

    print_success "Created git tag v$new_version"
}

# Function to publish to npm
publish_npm() {
    print_status "Publishing to npm..."
    npm publish
    print_success "Published to npm successfully"
}

# Function to publish to GitHub Packages
publish_github() {
    print_status "Publishing to GitHub Packages..."

    # Create temporary package.json with scoped name for GitHub
    local original_name=$(node -p "require('./package.json').name")
    local temp_package=$(mktemp)

    # Update package name for GitHub registry
    node -e "
        const pkg = require('./package.json');
        pkg.name = '@fluffylabs/typeberry';
        require('fs').writeFileSync('$temp_package', JSON.stringify(pkg, null, 2));
    "

    # Backup original package.json
    cp package.json package.json.backup
    cp "$temp_package" package.json

    # Publish to GitHub registry
    npm publish --registry=https://npm.pkg.github.com

    # Restore original package.json
    mv package.json.backup package.json
    rm "$temp_package"

    print_success "Published to GitHub Packages successfully"
}

# Function to push changes
push_changes() {
    print_status "Pushing changes to git..."
    git push origin main
    git push origin --tags
    print_success "Changes pushed to git"
}

# Function to create GitHub release
create_github_release() {
    local version=$(node -p "require('./package.json').version")
    local tag="v$version"

    print_status "Creating GitHub release..."

    if command -v gh >/dev/null 2>&1; then
        # Use GitHub CLI if available
        gh release create "$tag" \
            --title "Release $tag" \
            --notes "Release notes for $tag" \
            --draft
        print_success "GitHub release created (draft). Please edit and publish it manually."
    else
        print_warning "GitHub CLI not installed. Please create the release manually at:"
        echo "https://github.com/fluffylabs/typeberry/releases/new?tag=$tag"
    fi
}

# Main function
main() {
    print_status "Starting publish process for Typeberry..."

    # Parse command line arguments
    local skip_tests=false
    local skip_version=false
    local version_type=""
    local publish_targets=("npm" "github")

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                skip_tests=true
                shift
                ;;
            --skip-version)
                skip_version=true
                shift
                ;;
            --version)
                version_type="$2"
                shift 2
                ;;
            --npm-only)
                publish_targets=("npm")
                shift
                ;;
            --github-only)
                publish_targets=("github")
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-tests     Skip running tests"
                echo "  --skip-version   Skip version update"
                echo "  --version TYPE   Set version type (patch, minor, major, or specific version)"
                echo "  --npm-only       Publish only to npm"
                echo "  --github-only    Publish only to GitHub Packages"
                echo "  -h, --help       Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Pre-flight checks
    check_git_repo
    check_clean_working_tree
    check_npm_auth

    # Run tests if not skipped
    if [[ "$skip_tests" != true ]]; then
        run_tests
    fi

    # Update version if not skipped
    if [[ "$skip_version" != true ]]; then
        update_version "$version_type"
    fi

    # Build project
    build_project

    # Publish to selected targets
    for target in "${publish_targets[@]}"; do
        case $target in
            npm)
                publish_npm
                ;;
            github)
                publish_github
                ;;
        esac
    done

    # Push changes
    push_changes

    # Create GitHub release
    create_github_release

    print_success "Publish process completed successfully!"
    print_status "Don't forget to:"
    echo "  1. Edit and publish the GitHub release"
    echo "  2. Update the GitHub Pages documentation if needed"
    echo "  3. Announce the release to your community"
}

# Run main function with all arguments
main "$@"
