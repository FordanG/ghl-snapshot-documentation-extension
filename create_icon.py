#!/usr/bin/env python3
"""
Generate icons for GHL Snapshot Export Documentation extension.
Install dependencies: pip install pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_export_icon(size):
    """Create an icon representing CSV/data export."""
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Use purple color for branding
    bg_color = (139, 92, 246, 255)  # #8B5CF6 - purple
    accent_color = (255, 255, 255, 255)  # white

    # Draw rounded rectangle background
    padding = size // 8
    draw.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=size // 6,
        fill=bg_color
    )

    # Draw document icon
    doc_width = size // 2
    doc_height = size // 1.8
    doc_left = (size - doc_width) // 2
    doc_top = size // 4

    # Document body
    draw.rounded_rectangle(
        [(doc_left, doc_top), (doc_left + doc_width, doc_top + doc_height)],
        radius=size // 20,
        fill=accent_color
    )

    # Document lines (representing CSV rows)
    line_padding = size // 10
    line_count = 3 if size >= 48 else 2
    line_height = 2 if size >= 48 else 1
    line_spacing = (doc_height - 2 * line_padding) // (line_count + 1)

    for i in range(line_count):
        y = doc_top + line_padding + (i + 1) * line_spacing
        draw.rectangle(
            [(doc_left + line_padding, y),
             (doc_left + doc_width - line_padding, y + line_height)],
            fill=bg_color
        )

    # Draw download/export arrow
    arrow_size = size // 4
    arrow_x = size // 2
    arrow_y = size - size // 4
    arrow_width = size // 16 if size >= 48 else 2

    # Arrow shaft
    draw.rectangle(
        [(arrow_x - arrow_width, arrow_y - arrow_size // 2),
         (arrow_x + arrow_width, arrow_y)],
        fill=accent_color
    )

    # Arrow head
    arrow_head_size = arrow_size // 2
    arrow_head = [
        (arrow_x, arrow_y + arrow_width),  # point
        (arrow_x - arrow_head_size, arrow_y - arrow_head_size),  # left
        (arrow_x + arrow_head_size, arrow_y - arrow_head_size),  # right
    ]
    draw.polygon(arrow_head, fill=accent_color)

    return img

def main():
    """Generate all icon sizes."""
    sizes = [16, 48, 128]
    icons_dir = os.path.join(os.path.dirname(__file__), 'icons')

    # Create icons directory if it doesn't exist
    os.makedirs(icons_dir, exist_ok=True)

    for size in sizes:
        print(f"Generating {size}x{size} icon...")
        icon = create_export_icon(size)
        icon.save(os.path.join(icons_dir, f'icon{size}.png'))

    print("\n✓ Icons generated successfully!")
    print("Files created:")
    for size in sizes:
        print(f"  - icons/icon{size}.png")
    print("\nReload your Chrome extension to see the new icons.")

if __name__ == '__main__':
    main()
