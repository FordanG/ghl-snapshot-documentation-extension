#!/bin/bash

echo "🔨 Creating CRX file from built extension..."

# Paths
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIST_DIR="$(pwd)/dist"
KEY_FILE="$(pwd)/extension-key.pem"
OUTPUT_CRX="$(pwd)/snapshot-ai.crx"

# Check if dist directory exists
if [ ! -d "$DIST_DIR" ]; then
    echo "❌ Error: dist/ directory not found. Run 'npm run build' first."
    exit 1
fi

# Check if Chrome is installed
if [ ! -f "$CHROME" ]; then
    echo "❌ Error: Google Chrome not found at $CHROME"
    exit 1
fi

# Pack the extension
echo "📦 Packing extension..."

if [ -f "$KEY_FILE" ]; then
    echo "🔑 Using existing private key: extension-key.pem"
    "$CHROME" --pack-extension="$DIST_DIR" --pack-extension-key="$KEY_FILE" 2>/dev/null
else
    echo "🔑 Generating new private key..."
    "$CHROME" --pack-extension="$DIST_DIR" 2>/dev/null
fi

# Check if CRX was created
if [ -f "$DIST_DIR.crx" ]; then
    mv "$DIST_DIR.crx" "$OUTPUT_CRX"
    echo "✅ CRX file created: snapshot-ai.crx"

    # Move the key if it was just generated
    if [ -f "$DIST_DIR.pem" ]; then
        mv "$DIST_DIR.pem" "$KEY_FILE"
        echo "🔑 Private key saved: extension-key.pem"
        echo "⚠️  IMPORTANT: Keep extension-key.pem private and secure!"
    fi

    # Get file size
    SIZE=$(du -h "$OUTPUT_CRX" | cut -f1)
    echo "📊 CRX size: $SIZE"
    echo ""
    echo "✨ Done! Your CRX file is ready."
    echo ""
    echo "⚠️  Note: Chrome will show warnings when installing this CRX."
    echo "   Users will need to enable Developer Mode to install it."

else
    echo "❌ Failed to create CRX file"
    exit 1
fi
