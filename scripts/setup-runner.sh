#!/bin/bash
# Guardian Self-Hosted Runner Setup Script
# Version 1.0.0
# Run this on your local machine to setup GitHub Actions runner

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/senoldogann/Guardian"
RUNNER_VERSION="2.321.0"
RUNNER_DIR="$HOME/github-runner-guardian"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Guardian CI/CD Runner Setup v1.0.0    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Detect OS and Architecture
OS=""
ARCH=""

if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="osx"
    if [[ $(uname -m) == "arm64" ]]; then
        ARCH="arm64"
    else
        ARCH="x64"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    ARCH="x64"
else
    echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 System Information:${NC}"
echo "   OS: $OS"
echo "   Architecture: $ARCH"
echo ""

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18+. Current: $(node --version)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Check Rust (for Tauri)
if ! command -v rustc &> /dev/null; then
    echo -e "${YELLOW}⚠️  Rust not found. Installing...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
echo -e "${GREEN}✓ Rust $(rustc --version)${NC}"

# Check Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git $(git --version)${NC}"

echo ""

# Create runner directory
echo -e "${YELLOW}📁 Setting up runner directory...${NC}"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

# Download runner
echo -e "${YELLOW}⬇️  Downloading GitHub Actions runner v${RUNNER_VERSION}...${NC}"
RUNNER_FILE="actions-runner-${OS}-${ARCH}-${RUNNER_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_FILE}"

if [ -f "$RUNNER_FILE" ]; then
    echo -e "${YELLOW}   Runner already downloaded${NC}"
else
    curl -o "$RUNNER_FILE" -L "$DOWNLOAD_URL"
    echo -e "${GREEN}✓ Downloaded${NC}"
fi

# Extract
echo -e "${YELLOW}📦 Extracting...${NC}"
tar xzf "$RUNNER_FILE"
echo -e "${GREEN}✓ Extracted${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "1. ${BLUE}Get a registration token from GitHub:${NC}"
echo "   https://github.com/senoldogann/Guardian/settings/actions/runners"
echo "   Click 'New self-hosted runner' and copy the token"
echo ""
echo -e "2. ${BLUE}Configure the runner:${NC}"
echo "   cd $RUNNER_DIR"
echo "   ./config.sh --url $REPO_URL --token <YOUR_TOKEN>"
echo ""
echo -e "3. ${BLUE}Start the runner:${NC}"
echo "   ./run.sh"
echo ""
echo -e "4. ${BLUE}To run as a service (recommended):${NC}"
echo "   ./svc.sh install"
echo "   ./svc.sh start"
echo ""
echo -e "${YELLOW}Runner Directory:${NC} $RUNNER_DIR"
echo ""
echo -e "${GREEN}🎉 Your CI/CD pipeline is ready!${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} This runner will execute on your local machine."
echo "       Ensure your machine is online for CI/CD to work."
