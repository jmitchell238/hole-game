#!/usr/bin/env python3
"""Verify transparency in fixed PNGs."""

from pathlib import Path
from PIL import Image


def verify_file(png_path):
    """Verify transparency in a PNG file."""
    img = Image.open(png_path).convert("RGBA")
    width, height = img.size
    img_data = img.tobytes()

    # Get corner alphas
    corners = [
        (0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)
    ]
    corner_alphas = []
    for x, y in corners:
        idx = (y * width + x) * 4 + 3
        corner_alphas.append(img_data[idx])

    # Get edge midpoint alphas
    edge_alphas = []
    mid_x, mid_y = width // 2, height // 2

    # Top edge midpoint
    idx = (0 * width + mid_x) * 4 + 3
    edge_alphas.append(img_data[idx])

    # Bottom edge midpoint
    idx = ((height - 1) * width + mid_x) * 4 + 3
    edge_alphas.append(img_data[idx])

    # Left edge midpoint
    idx = (mid_y * width + 0) * 4 + 3
    edge_alphas.append(img_data[idx])

    # Right edge midpoint
    idx = (mid_y * width + (width - 1)) * 4 + 3
    edge_alphas.append(img_data[idx])

    # Count transparent pixels
    transparent_count = 0
    for i in range(3, len(img_data), 4):
        if img_data[i] == 0:
            transparent_count += 1

    percent_transparent = (transparent_count / (width * height)) * 100

    return corner_alphas, edge_alphas, percent_transparent


def main():
    fixed_dir = Path("art/fixed")
    fixed_files = sorted(fixed_dir.glob("*.png"))

    print(f"Verifying {len(fixed_files)} files...\n")

    for png_file in fixed_files:
        try:
            corner_alphas, edge_alphas, percent_transparent = verify_file(png_file)
            print(f"{png_file.name}:")
            print(f"  Corner alphas: {corner_alphas}")
            print(f"  Edge-midpoint alphas: {edge_alphas}")
            print(f"  Transparent pixels: {percent_transparent:.1f}%")
        except Exception as e:
            print(f"{png_file.name}: ERROR - {e}")

    print("\nVerification complete.")


if __name__ == "__main__":
    main()
