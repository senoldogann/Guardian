#!/bin/bash
set -e

CONFIG_DIR="$HOME/.antigravity"
CONFIG_FILE="$CONFIG_DIR/argv.json"
BACKUP_FILE="$CONFIG_DIR/argv.json.bak.$(date +%s)"

echo "🔍 Checking Antigravity configuration..."

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file not found at: $CONFIG_FILE"
    exit 1
fi

# Check if port is already enabled
if grep -q "remote-debugging-port" "$CONFIG_FILE"; then
    echo "✅ Remote debugging port is already configured."
    grep "remote-debugging-port" "$CONFIG_FILE"
    exit 0
fi

echo "📦 Backing up config to $BACKUP_FILE"
cp "$CONFIG_FILE" "$BACKUP_FILE"

# Inject the port setting
# We use a temporary file and sed to insert it before the closing brace
# Note: This is a simple injection, assuming standard JSON formatting ending with }
echo "🔧 Enabling remote debugging on port 9222..."

# Remove the last closing brace and add the comma + new key
sed -i '' '$s/}/, "remote-debugging-port": 9222 }/' "$CONFIG_FILE"

# Pretty print if jq is available, otherwise just leave it (it's valid JSON)
if command -v jq &> /dev/null; then
    tmp=$(mktemp)
    jq '.' "$CONFIG_FILE" > "$tmp" && mv "$tmp" "$CONFIG_FILE"
fi

echo "✅ Configuration updated successfully!"
echo "⚠️  PLEASE RESTART ANTIGRAVITY FOR CHANGES TO TAKE EFFECT."
