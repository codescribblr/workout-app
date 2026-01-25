#!/bin/bash

# Helper script to URL-encode a password for use in connection strings
# Usage: ./scripts/url-encode-password.sh "your^password\$here"

if [ -z "$1" ]; then
    echo "Usage: $0 <password>"
    exit 1
fi

PASSWORD="$1"

# Use Python for URL encoding (most reliable)
if command -v python3 >/dev/null 2>&1; then
    ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$PASSWORD', safe=''))")
    echo "$ENCODED"
elif command -v python >/dev/null 2>&1; then
    ENCODED=$(python -c "import urllib.parse; print(urllib.parse.quote('$PASSWORD', safe=''))")
    echo "$ENCODED"
else
    echo "Error: Python not found. Please install Python to use URL encoding."
    exit 1
fi
