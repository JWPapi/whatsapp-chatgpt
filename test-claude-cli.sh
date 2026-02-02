#!/bin/bash
# Test script to debug Claude CLI issues

echo "=== Testing Claude CLI ==="
echo ""

echo "1. Checking if claude is installed..."
which claude || echo "ERROR: claude not found in PATH"

echo ""
echo "2. Claude version:"
claude --version 2>&1 || echo "ERROR: Could not get version"

echo ""
echo "3. Checking ANTHROPIC_API_KEY..."
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set"
elif [ "$ANTHROPIC_API_KEY" = "YOUR_KEY_HERE" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is still placeholder"
else
  echo "OK: ANTHROPIC_API_KEY is set (starts with ${ANTHROPIC_API_KEY:0:10}...)"
fi

echo ""
echo "4. Testing simple claude command..."
echo "Running: claude --print 'say hello' --dangerously-skip-permissions"
timeout 30 claude --print "say hello" --dangerously-skip-permissions 2>&1 || echo "ERROR: Command failed with code $?"

echo ""
echo "=== Test complete ==="
