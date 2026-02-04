#!/bin/bash
green='\033[0;32m'
red='\033[0;31m'
nc='\033[0m'

echo -e "${green}🛑 Antigravity Debug Launcher${nc}"
echo "We are switching to MANUAL OVERRIDE mode."

# 1. Kill Check
if pgrep -f "Antigravity" > /dev/null; then
    echo -e "${red}Detected running Antigravity instance. Terminating...${nc}"
    pkill -f "Antigravity"
    sleep 2
else
    echo "No running instance found."
fi

# 2. Launch with Flag (Direct Binary)
BINARY_PATH="/Applications/Antigravity.app/Contents/MacOS/Electron"
LOG_FILE="$HOME/antigravity-debug.log"

echo -e "${green}🚀 Launching Antigravity Binary directly...${nc}"
echo "Logs will be written to: $LOG_FILE"

# Execute in background, nohup to persist
nohup "$BINARY_PATH" --remote-debugging-port=9222 > "$LOG_FILE" 2>&1 &

echo "Waiting for warmup (5s)..."
sleep 5

# 3. Validation
if lsof -i :9222 > /dev/null; then
    echo -e "${green}✅ SUCCESS! Port 9222 is OPEN.${nc}"
    echo "Vision Autopilot is allowed to engage."
    echo "Tail of log:"
    tail -n 5 "$LOG_FILE"
else
    echo -e "${red}❌ FAILURE: Port 9222 is still CLOSED.${nc}"
    echo "Checking logs for errors:"
    cat "$LOG_FILE"
    exit 1
fi
