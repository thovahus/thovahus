#!/usr/bin/env python3
"""Render a photo as a retro pixel-art SVG (dark + light variants).

Crop/frame the photo the way you want it beforehand -- this just downsamples
and quantizes whatever image it's given.

Usage: python3 scripts/generate_pixel_portrait.py <photo> [--columns N] [--colors N] [--out-dir DIR]
"""
import argparse
from pathlib import Path

from PIL import Image, ImageEnhance

DEFAULT_COLUMNS = 48
DEFAULT_PALETTE_SIZE = 24
CELL = 9
GAP = 0

THEMES = {
    "dark": {"bg": "#0d1117", "frame": "#30363d"},
    "light": {"bg": "#ffffff", "frame": "#d0d7de"},
}


def photo_to_pixel_grid(photo_path, columns, colors):
    image = Image.open(photo_path).convert("RGB")
    image = ImageEnhance.Contrast(image).enhance(1.2)
    image = ImageEnhance.Color(image).enhance(1.3)

    rows = max(1, round(columns * image.height / image.width))
    small = image.resize((columns, rows), Image.LANCZOS)
    small = small.quantize(colors, method=Image.MEDIANCUT).convert("RGB")
    return list(small.getdata()), rows


def render_svg(pixels, columns, rows, theme_name):
    theme = THEMES[theme_name]
    stride = CELL + GAP
    width = columns * stride + GAP
    height = rows * stride + GAP

    row_delays = "\n".join(
        f"    .r{row} {{ animation-delay: {round(row * 0.03, 3)}s; }}" for row in range(rows)
    )
    cells = "".join(
        f'<rect x="{GAP + (i % columns) * stride}" y="{GAP + (i // columns) * stride}" '
        f'width="{CELL}" height="{CELL}" fill="rgb({r},{g},{b})" class="px r{i // columns}"/>'
        for i, (r, g, b) in enumerate(pixels)
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <style>
    .px {{ opacity: 0; animation: appear 0.4s ease-out forwards; }}
    @keyframes appear {{
      from {{ opacity: 0; transform: scale(0); transform-origin: center; }}
      to {{ opacity: 1; transform: scale(1); }}
    }}
{row_delays}
  </style>
  <rect width="100%" height="100%" fill="{theme['bg']}" />
  <rect x="0.5" y="0.5" width="{width - 1}" height="{height - 1}" fill="none" stroke="{theme['frame']}" rx="6" />
  {cells}
</svg>
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photo", type=Path)
    parser.add_argument("--columns", type=int, default=DEFAULT_COLUMNS)
    parser.add_argument("--colors", type=int, default=DEFAULT_PALETTE_SIZE)
    parser.add_argument("--out-dir", type=Path, default=Path("assets"))
    args = parser.parse_args()

    pixels, rows = photo_to_pixel_grid(args.photo, args.columns, args.colors)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    for theme_name in THEMES:
        out_path = args.out_dir / f"pixel-{args.photo.stem}-{theme_name}.svg"
        out_path.write_text(render_svg(pixels, args.columns, rows, theme_name))
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
