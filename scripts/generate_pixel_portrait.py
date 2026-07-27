#!/usr/bin/env python3
"""Render a photo as a retro pixel-art SVG (dark + light variants).

Usage: python3 scripts/generate_pixel_portrait.py <photo> [output-dir]
"""
import sys
from pathlib import Path

from PIL import Image

COLUMNS = 48
PALETTE_SIZE = 24
CELL = 9
GAP = 0
CROP_BOX = (0.12, 0.05, 0.88, 0.95)  # left, top, right, bottom as fractions

THEMES = {
    "dark": {"bg": "#0d1117", "frame": "#30363d"},
    "light": {"bg": "#ffffff", "frame": "#d0d7de"},
}


def photo_to_pixel_grid(photo_path, columns=COLUMNS, colors=PALETTE_SIZE):
    image = Image.open(photo_path).convert("RGB")
    width, height = image.size
    left, top, right, bottom = CROP_BOX
    image = image.crop((left * width, top * height, right * width, bottom * height))

    rows = max(1, round(columns * image.height / image.width))
    small = image.resize((columns, rows), Image.LANCZOS)
    small = small.quantize(colors, method=Image.MEDIANCUT).convert("RGB")
    return list(small.getdata()), columns, rows


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
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    pixels, columns, rows = photo_to_pixel_grid(sys.argv[1])

    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("assets")
    out_dir.mkdir(parents=True, exist_ok=True)

    for theme_name in THEMES:
        out_path = out_dir / f"pixel-portrait-{theme_name}.svg"
        out_path.write_text(render_svg(pixels, columns, rows, theme_name))
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
