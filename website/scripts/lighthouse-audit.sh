#!/bin/bash

##############################################################
# Lighthouse Performance Audit Script
# 
# Runs Lighthouse CI on the website and generates reports
# Requires: Node.js, Chrome/Chromium
##############################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Guardian Website - Lighthouse Audit  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if server is running
SERVER_URL="http://localhost:3000"
if ! curl -s --head --request GET "$SERVER_URL" | grep "200\|301" > /dev/null; then
    echo -e "${YELLOW}⚠️  Dev server not running. Starting...${NC}"
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start (max 30 seconds)
    for i in {1..30}; do
        if curl -s --head --request GET "$SERVER_URL" | grep "200\|301" > /dev/null; then
            echo -e "${GREEN}✓ Server started${NC}"
            break
        fi
        sleep 1
    done
else
    echo -e "${GREEN}✓ Server is running${NC}"
    SERVER_PID=""
fi

echo ""
echo -e "${BLUE}Running Lighthouse on key pages...${NC}"
echo ""

# Install Lighthouse if not present
if ! command -v lighthouse &> /dev/null; then
    echo -e "${YELLOW}Installing Lighthouse CLI...${NC}"
    npm install -g @lhci/cli lighthouse
fi

# Create reports directory
mkdir -p lighthouse-reports

# Pages to audit
PAGES=(
    "/"
    "/features"
    "/download"
    "/docs"
    "/privacy-policy"
)

# Run Lighthouse on each page
for PAGE in "${PAGES[@]}"; do
    PAGE_NAME=$(echo "$PAGE" | tr '/' '-' | sed 's/^-//' | sed 's/-$//')
    if [ -z "$PAGE_NAME" ]; then
        PAGE_NAME="homepage"
    fi
    
    echo -e "${YELLOW}Auditing: $PAGE${NC}"
    
    lighthouse "$SERVER_URL$PAGE" \
        --output=html \
        --output=json \
        --output-path="./lighthouse-reports/$PAGE_NAME" \
        --chrome-flags="--headless" \
        --only-categories=performance,accessibility,best-practices,seo \
        --quiet
    
    echo -e "${GREEN}✓ $PAGE_NAME complete${NC}"
    echo ""
done

# Kill dev server if we started it
if [ -n "$SERVER_PID" ]; then
    echo -e "${YELLOW}Stopping dev server...${NC}"
    kill "$SERVER_PID" 2>/dev/null || true
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Lighthouse Audit Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "📊 Reports saved to: ${YELLOW}lighthouse-reports/${NC}"
echo ""
echo -e "View HTML reports:"
for PAGE in "${PAGES[@]}"; do
    PAGE_NAME=$(echo "$PAGE" | tr '/' '-' | sed 's/^-//' | sed 's/-$//')
    if [ -z "$PAGE_NAME" ]; then
        PAGE_NAME="homepage"
    fi
    echo -e "  open lighthouse-reports/${PAGE_NAME}.report.html"
done
echo ""

# Parse scores from JSON reports
echo -e "${BLUE}Score Summary:${NC}"
echo ""

for PAGE in "${PAGES[@]}"; do
    PAGE_NAME=$(echo "$PAGE" | tr '/' '-' | sed 's/^-//' | sed 's/-$//')
    if [ -z "$PAGE_NAME" ]; then
        PAGE_NAME="homepage"
    fi
    
    JSON_FILE="lighthouse-reports/${PAGE_NAME}.report.json"
    
    if [ -f "$JSON_FILE" ]; then
        PERF=$(jq '.categories.performance.score * 100 | floor' "$JSON_FILE")
        ACCESS=$(jq '.categories.accessibility.score * 100 | floor' "$JSON_FILE")
        BEST=$(jq '.categories["best-practices"].score * 100 | floor' "$JSON_FILE")
        SEO=$(jq '.categories.seo.score * 100 | floor' "$JSON_FILE")
        
        echo -e "${YELLOW}$PAGE${NC}"
        echo "  Performance:     $PERF"
        echo "  Accessibility:   $ACCESS"
        echo "  Best Practices:  $BEST"
        echo "  SEO:             $SEO"
        echo ""
    fi
done

echo -e "${BLUE}Target Scores:${NC} Performance: 90+, Accessibility: 95+, Best Practices: 95+, SEO: 95+"
echo ""
