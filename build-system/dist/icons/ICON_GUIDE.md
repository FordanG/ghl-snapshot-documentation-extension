# Icon Guide

You need to create 3 icon files for this extension:

- `icon16.png` - 16x16 pixels (used in toolbar)
- `icon48.png` - 48x48 pixels (used in extension management)
- `icon128.png` - 128x128 pixels (used in Chrome Web Store)

## Quick Ways to Create Icons

### Option 1: Use an Online Tool
1. Go to https://favicon.io/ or https://www.canva.com/
2. Create a simple logo/icon with "GHL" text or a relevant symbol
3. Download in PNG format
4. Resize to 16x16, 48x48, and 128x128 pixels

### Option 2: Use Figma/Sketch/Photoshop
1. Create a new artboard at 128x128 pixels
2. Design your icon (keep it simple and recognizable)
3. Export at 3 sizes: 16x16, 48x48, 128x128

### Option 3: Use a Simple Colored Square (Quick Test)
If you just want to test the extension quickly:
1. Create simple colored PNG squares at each size
2. Use any color you like (blue, green, etc.)

### Option 4: Use ImageMagick (Command Line)
```bash
# Create a simple blue icon with "GHL" text
convert -size 128x128 xc:#4f9eff -gravity center -pointsize 48 -fill white -annotate +0+0 "GHL" icon128.png
convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

## Design Tips

- Use high contrast colors for better visibility
- Keep the design simple - it needs to be recognizable at 16x16 pixels
- Use your brand colors if applicable
- Test at smallest size (16x16) to ensure it's still clear

## Example Color Schemes

- **Blue & White**: `#4f9eff` background with white icon/text
- **Dark & Accent**: `#1a1a1a` background with `#4f9eff` icon/text
- **GHL Brand**: Use GoHighLevel's brand colors if preferred
