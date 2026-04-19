#!/bin/bash
set -e

# Renkler
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Guardian Release Build Script${NC}"
echo "-----------------------------------"

# 1. Private Key Kontrolü
KEY_PATH="$HOME/.tauri/guardian.key"
if [ ! -f "$KEY_PATH" ]; then
    echo -e "${RED}Error: Private key not found at $KEY_PATH${NC}"
    exit 1
fi

echo "Reading private key from $KEY_PATH..."
export TAURI_SIGNING_PRIVATE_KEY=$(cat "$KEY_PATH")

# 2. Şifre Okuma (env var varsa kullan, yoksa interaktif sor)
if [ -n "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ]; then
    echo "Using password from TAURI_SIGNING_PRIVATE_KEY_PASSWORD env var..."
else
    echo -n "Enter password for private key: "
    read -s TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    echo ""
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD

    if [ -z "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ]; then
        echo -e "${RED}Warning: Password is empty. Proceeding anyway (might fail if key is encrypted).${NC}"
    fi
fi

# 3. Build Başlatma
echo -e "${GREEN}🚀 Starting build process...${NC}"

# Eğer guardian klasöründeysek (package.json varsa), cd yapma
if [ -f "package.json" ]; then
    echo "Running in current directory..."
    npm run tauri build
elif [ -d "guardian" ]; then
    echo "Changing to guardian directory..."
    cd guardian && npm run tauri build
else
    echo -e "${RED}Error: Cannot find guardian project root (package.json not found).${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully!${NC}"
