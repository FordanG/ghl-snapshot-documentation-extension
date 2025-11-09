# Creating Icons for the Extension

The extension requires three icon sizes. Here are several methods to create them:

## Option 1: Use Online Icon Generator

1. Go to https://www.favicon-generator.org/ or https://realfavicongenerator.net/
2. Upload an image (use the camera emoji 📸 or any image)
3. Generate icons
4. Download and rename to:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)
5. Place them in the `icons/` folder

## Option 2: Copy from GHL Utils

If you have GHL Utils installed:

```bash
cp "/Users/poppo/Projects/GHL Utils/icons/"* "/Users/poppo/Projects/snapshot-export-documentation/icons/"
```

## Option 3: Create with ImageMagick

If you have ImageMagick installed:

```bash
cd "/Users/poppo/Projects/snapshot-export-documentation/icons"

# Create a simple colored square as placeholder
convert -size 128x128 xc:#7c3aed -fill white -pointsize 80 -gravity center -annotate +0+0 "📸" icon128.png
convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

## Option 4: Use GIMP or Photoshop

1. Create a new image:
   - 128x128 pixels
   - Purple background (#7c3aed)
   - Add text or emoji: 📸
2. Export as `icon128.png`
3. Resize to 48x48 and save as `icon48.png`
4. Resize to 16x16 and save as `icon16.png`

## Temporary Workaround

For development, you can:

1. Remove the icons section from `manifest.json`
2. Or use any three PNG files named correctly (they just need to exist)

## After Creating Icons

1. Place all three files in the `icons/` folder
2. Reload the extension in Chrome (`chrome://extensions/` → Reload)
3. The icon should appear in your Chrome toolbar
