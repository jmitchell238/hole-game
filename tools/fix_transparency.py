#!/usr/bin/env python3
"""Fix transparency in art PNGs by removing baked-in backgrounds."""

import argparse
import os
from collections import defaultdict
from pathlib import Path
from queue import Queue

from PIL import Image


def cluster_colors(pixels, border_size):
    """Cluster border pixels by rounding to nearest 8."""
    clusters = defaultdict(int)
    for r, g, b, a in pixels:
        # Round each channel to nearest 8
        key = (round(r / 8) * 8, round(g / 8) * 8, round(b / 8) * 8)
        clusters[key] += 1

    total = sum(clusters.values())
    threshold = max(1, total // 100)  # >1% of border

    return {color for color, count in clusters.items() if count > threshold}


def color_distance(c1, c2, tolerance=16):
    """Check if colors are within tolerance."""
    return max(abs(c1[i] - c2[i]) for i in range(3)) <= tolerance


def flood_fill(img_data, width, height, bg_colors, tolerance):
    """BFS flood fill from border pixels."""
    filled = set()
    queue = Queue()

    # Start from all border pixels matching background colors
    for x in range(width):
        for y in [0, height - 1]:  # Top and bottom rows
            if is_bg_pixel(img_data, x, y, width, bg_colors, tolerance):
                queue.put((x, y))
                filled.add((x, y))

    for y in range(height):
        for x in [0, width - 1]:  # Left and right columns
            if is_bg_pixel(img_data, x, y, width, bg_colors, tolerance):
                if (x, y) not in filled:
                    queue.put((x, y))
                    filled.add((x, y))

    # BFS expand
    while not queue.empty():
        x, y = queue.get()
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in filled:
                if is_bg_pixel(img_data, nx, ny, width, bg_colors, tolerance):
                    filled.add((nx, ny))
                    queue.put((nx, ny))

    return filled


def is_bg_pixel(img_data, x, y, width, bg_colors, tolerance):
    """Check if pixel matches any background color."""
    idx = (y * width + x) * 4
    r, g, b, a = img_data[idx], img_data[idx + 1], img_data[idx + 2], img_data[idx + 3]

    for bg_color in bg_colors:
        if color_distance((r, g, b), bg_color, tolerance):
            return True
    return False


def fix_transparency(input_path, output_path, tolerance=16):
    """Fix transparency in a PNG file."""
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    img_data = bytearray(img.tobytes())

    # Check if already transparent (corners)
    corners = [
        (0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)
    ]
    corner_alphas = []
    for x, y in corners:
        idx = (y * width + x) * 4 + 3
        corner_alphas.append(img_data[idx])

    if all(a < 10 for a in corner_alphas):
        return None, None, 0, "already transparent — skipped"

    # Collect border pixels
    border_pixels = []
    for x in range(width):
        for y in [0, height - 1]:
            idx = (y * width + x) * 4
            border_pixels.append(tuple(img_data[idx:idx + 4]))

    for y in range(height):
        for x in [0, width - 1]:
            idx = (y * width + x) * 4
            border_pixels.append(tuple(img_data[idx:idx + 4]))

    # Cluster background colors
    bg_colors = cluster_colors(border_pixels, len(border_pixels))

    if not bg_colors:
        return None, None, 0, "no background colors detected"

    # Flood fill
    filled = flood_fill(img_data, width, height, bg_colors, tolerance)

    # Clear filled pixels
    for x, y in filled:
        idx = (y * width + x) * 4
        img_data[idx + 3] = 0

    # Edge softening
    for x in range(width):
        for y in range(height):
            if (x, y) not in filled:
                idx = (y * width + x) * 4
                current_alpha = img_data[idx + 3]

                # Check 4-neighbors
                for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        if (nx, ny) in filled:
                            img_data[idx + 3] = min(current_alpha, 128)
                            break

    # Calculate percentage cleared
    percent_cleared = (len(filled) / (width * height)) * 100

    # Warning check
    warning = ""
    if percent_cleared > 95 or percent_cleared < 5:
        warning = f"WARNING: {percent_cleared:.1f}% cleared (check for dark/light backgrounds)"

    # Write output
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    result_img = Image.frombytes("RGBA", (width, height), bytes(img_data))
    result_img.save(output_path)

    return bg_colors, percent_cleared, len(filled), warning


def main():
    parser = argparse.ArgumentParser(
        description="Strip baked backgrounds from art PNGs"
    )
    parser.add_argument(
        "files",
        nargs="*",
        help="Specific PNG files to process (default: all in art/)",
    )
    parser.add_argument(
        "--tolerance",
        type=int,
        default=16,
        help="Color distance tolerance (default: 16)",
    )
    args = parser.parse_args()

    # Determine which files to process
    if args.files:
        png_files = [Path(f) for f in args.files if f.endswith(".png")]
    else:
        png_files = sorted(Path("art").glob("*.png"))

    print(f"Processing {len(png_files)} files...\n")

    for png_file in png_files:
        output_file = Path("art/fixed") / png_file.name

        try:
            bg_colors, percent, filled_count, msg = fix_transparency(
                str(png_file), str(output_file), args.tolerance
            )

            if bg_colors is None:
                print(f"  {png_file.name}: {msg}")
            else:
                bg_hex = ", ".join(f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}" for c in bg_colors)
                print(f"  {png_file.name}:")
                print(f"    Background colors: {bg_hex}")
                print(f"    Pixels cleared: {percent:.1f}%")
                print(f"    Output: {output_file}")
                if msg:
                    print(f"    {msg}")
        except Exception as e:
            print(f"  {png_file.name}: ERROR - {e}")

    print("\nDone.")


if __name__ == "__main__":
    main()
