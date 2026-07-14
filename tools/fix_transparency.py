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


def find_center_disc(img_data, width, height, tolerance=16):
    """Flood-fill from center pixel to find enclosed filled disc region.
    Returns bounding box (min_x, min_y, max_x, max_y) or None if center is already transparent."""
    cx, cy = width // 2, height // 2
    center_idx = (cy * width + cx) * 4
    center_color = (img_data[center_idx], img_data[center_idx + 1], img_data[center_idx + 2], img_data[center_idx + 3])

    # If center is already transparent, skip center punch
    if center_color[3] < 10:
        return None

    # Flood-fill from center to find all connected pixels similar to center
    filled = set()
    queue = Queue()
    queue.put((cx, cy))
    filled.add((cx, cy))

    seed_rgb = center_color[:3]

    while not queue.empty():
        x, y = queue.get()
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in filled:
                nidx = (ny * width + nx) * 4
                npixel = (img_data[nidx], img_data[nidx + 1], img_data[nidx + 2], img_data[nidx + 3])
                # Check if pixel color is similar to seed and alpha > 10
                if npixel[3] > 10 and color_distance(npixel[:3], seed_rgb, tolerance):
                    filled.add((nx, ny))
                    queue.put((nx, ny))

    if not filled:
        return None

    # Compute bounding box
    xs = [x for x, y in filled]
    ys = [y for x, y in filled]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    return (min_x, min_y, max_x, max_y)


def punch_center_circle(img_data, width, height, bbox, feather_radius=2.0):
    """Erase an exact circle at bbox center with feathered edge."""
    min_x, min_y, max_x, max_y = bbox

    # Circle center and radius
    disc_cx = (min_x + max_x) / 2.0
    disc_cy = (min_y + max_y) / 2.0

    half_width = (max_x - min_x) / 2.0
    half_height = (max_y - min_y) / 2.0

    # Sanity check: bbox width vs height within ~8%
    if half_width == 0 or half_height == 0:
        return False, "bbox has zero dimension"

    aspect = max(half_width, half_height) / min(half_width, half_height)
    if aspect > 1.12:
        return False, f"disc aspect ratio {aspect:.3f} not circular"

    # Radius = average of half-width and half-height
    radius = (half_width + half_height) / 2.0

    # Erase with feathered edge
    for y in range(height):
        for x in range(width):
            dx = x - disc_cx
            dy = y - disc_cy
            dist = (dx*dx + dy*dy) ** 0.5

            # Feathered edge: linear fade from radius-feather_radius to radius
            if dist < radius - feather_radius:
                # Fully transparent
                idx = (y * width + x) * 4
                img_data[idx + 3] = 0
            elif dist < radius + feather_radius:
                # Feathered edge
                alpha_fade = (dist - (radius - feather_radius)) / (2.0 * feather_radius)
                alpha_fade = max(0, min(1, alpha_fade))
                idx = (y * width + x) * 4
                img_data[idx + 3] = int(img_data[idx + 3] * alpha_fade)

    return True, f"punched circle: cx={disc_cx:.1f} cy={disc_cy:.1f} r={radius:.1f}"


def fix_transparency(input_path, output_path, tolerance=16):
    """Fix transparency in a PNG file: strip background, then punch center disc."""
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
        # Already has transparent corners; still try to punch center
        center_bbox = find_center_disc(img_data, width, height, tolerance)
        if center_bbox is None:
            return None, None, 0, "already transparent — skipped"

        # Punch the center
        success, msg = punch_center_circle(img_data, width, height, center_bbox, feather_radius=2.0)
        if not success:
            return None, None, 0, f"center punch skipped: {msg}"

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        result_img = Image.frombytes("RGBA", (width, height), bytes(img_data))
        result_img.save(output_path)

        # Derive constants from the punched region
        bbox = center_bbox
        disc_cx = (bbox[0] + bbox[2]) / 2.0 / width
        disc_cy = (bbox[1] + bbox[3]) / 2.0 / height
        half_w = (bbox[2] - bbox[0]) / 2.0
        half_h = (bbox[3] - bbox[1]) / 2.0
        disc_r = (half_w + half_h) / 2.0 / width

        return {}, 0, 0, f"center punch only: {{ cx: {disc_cx:.6f}, cy: {disc_cy:.6f}, rf: {disc_r:.6f} }}"

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

    # Now try to punch the center disc
    center_bbox = find_center_disc(img_data, width, height, tolerance)

    punch_msg = ""
    if center_bbox is not None:
        success, punch_msg = punch_center_circle(img_data, width, height, center_bbox, feather_radius=2.0)
        if not success:
            punch_msg = f"center punch skipped: {punch_msg}"

    # Calculate percentage cleared
    percent_cleared = (len(filled) / (width * height)) * 100

    # Warning check
    warning = ""
    if percent_cleared > 95 or percent_cleared < 5:
        warning = f"WARNING: {percent_cleared:.1f}% cleared (check for dark/light backgrounds)"
    if punch_msg:
        if warning:
            warning += "; " + punch_msg
        else:
            warning = punch_msg

    # Write output
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    result_img = Image.frombytes("RGBA", (width, height), bytes(img_data))
    result_img.save(output_path)

    # Derive constants from the punched region
    js_const = ""
    if center_bbox is not None:
        bbox = center_bbox
        disc_cx = (bbox[0] + bbox[2]) / 2.0 / width
        disc_cy = (bbox[1] + bbox[3]) / 2.0 / height
        half_w = (bbox[2] - bbox[0]) / 2.0
        half_h = (bbox[3] - bbox[1]) / 2.0
        disc_r = (half_w + half_h) / 2.0 / width
        js_const = f"{{ cx: {disc_cx:.6f}, cy: {disc_cy:.6f}, rf: {disc_r:.6f} }}"

    return bg_colors, percent_cleared, len(filled), warning, js_const


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

    # Track JS constants for all files
    js_constants = {}

    for png_file in png_files:
        output_file = Path("art/fixed") / png_file.name

        try:
            result = fix_transparency(
                str(png_file), str(output_file), args.tolerance
            )

            # Unpack result (now has 5 elements for some files)
            if len(result) == 5:
                bg_colors, percent, filled_count, msg, js_const = result
            else:
                bg_colors, percent, filled_count, msg = result
                js_const = ""

            if bg_colors is None:
                print(f"  {png_file.name}: {msg}")
            else:
                bg_hex = ", ".join(f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}" for c in bg_colors) if bg_colors else ""
                print(f"  {png_file.name}:")
                if bg_hex:
                    print(f"    Background colors: {bg_hex}")
                    print(f"    Pixels cleared: {percent:.1f}%")
                print(f"    Output: {output_file}")
                if msg:
                    print(f"    {msg}")
                if js_const:
                    base_name = png_file.stem
                    js_constants[base_name] = js_const
                    print(f"    Constants: {base_name}: {js_const}")
        except Exception as e:
            print(f"  {png_file.name}: ERROR - {e}")

    if js_constants:
        print("\n=== JavaScript Constants (ready to paste) ===")
        for name, const in sorted(js_constants.items()):
            print(f"  {name}: {const},")

    print("\nDone.")


if __name__ == "__main__":
    main()
