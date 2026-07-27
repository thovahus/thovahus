#!/usr/bin/env python3
"""
Convert a photo into a monospace ASCII-art portrait rendered as an animated SVG.

Usage:
    python3 scripts/generate_ascii_portrait.py <source-photo> [output.svg]

The output SVG types itself out line-by-line when viewed on GitHub (each row
fades/slides in with a staggered CSS animation-delay), finishing with a
blinking terminal cursor. To refresh the portrait, drop in a new photo and
re-run this script -- no external services or tokens required.
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

# Darkest -> lightest. Fewer, denser characters read better at small sizes.
RAMP = "@%#*+=-:. "

# Terminal character cells are taller than they are wide; compensate so the
# final ASCII grid isn't vertically squashed.
CHAR_ASPECT = 0.52

COLUMNS = 100
FONT_SIZE = 6.2
LINE_HEIGHT = FONT_SIZE * 1.0
CHAR_WIDTH = FONT_SIZE * 0.6


def image_to_ascii_rows(path: str, columns: int = COLUMNS) -> list[str]:
    img = Image.open(path).convert("L")
    img = ImageOps.autocontrast(img, cutoff=1)

    src_w, src_h = img.size
    rows = max(1, round((columns * src_h * CHAR_ASPECT) / src_w))
    img = img.resize((columns, rows))

    pixels = list(img.getdata())
    ramp_len = len(RAMP) - 1

    lines = []
    for r in range(rows):
        row_pixels = pixels[r * columns:(r + 1) * columns]
        line = "".join(RAMP[int(p / 255 * ramp_len)] for p in row_pixels)
        lines.append(line)
    return lines


def escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_svg(lines: list[str], theme: str = "dark") -> str:
    columns = max(len(l) for l in lines)
    width = round(columns * CHAR_WIDTH + 24)
    height = round(len(lines) * LINE_HEIGHT + 24)

    if theme == "dark":
        bg = "#0d1117"
        fg = "#39d353"
        dim_fg = "#196c2e"
    else:
        bg = "#ffffff"
        fg = "#216e39"
        dim_fg = "#9be9a8"

    text_elems = []
    for i, line in enumerate(lines):
        y = 16 + i * LINE_HEIGHT
        delay = round(i * 0.045, 3)
        text_elems.append(
            f'<text x="12" y="{y:.2f}" class="row" '
            f'style="animation-delay:{delay}s">{escape(line)}</text>'
        )

    cursor_y = 16 + len(lines) * LINE_HEIGHT
    total_delay = round(len(lines) * 0.045 + 0.2, 3)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <style>
    svg {{ background: {bg}; }}
    text {{
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: {FONT_SIZE}px;
      fill: {fg};
      white-space: pre;
      opacity: 0;
    }}
    .row {{
      animation: reveal 0.5s ease-out forwards;
    }}
    @keyframes reveal {{
      0%   {{ opacity: 0; transform: translateX(-6px); }}
      100% {{ opacity: 1; transform: translateX(0); }}
    }}
    .cursor {{
      fill: {dim_fg};
      animation: blink 1s step-end infinite;
      animation-delay: {total_delay}s;
    }}
    @keyframes blink {{
      0%, 100% {{ opacity: 1; }}
      50% {{ opacity: 0; }}
    }}
  </style>
  <rect width="100%" height="100%" fill="{bg}" />
  {''.join(text_elems)}
  <text x="12" y="{cursor_y:.2f}" class="cursor">▍</text>
</svg>
"""
    return svg


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    source = sys.argv[1]
    lines = image_to_ascii_rows(source)

    out_dir = Path(sys.argv[2]).parent if len(sys.argv) > 2 else Path("assets")
    out_dir.mkdir(parents=True, exist_ok=True)

    dark_path = Path(sys.argv[2]) if len(sys.argv) > 2 else out_dir / "ascii-portrait-dark.svg"
    light_path = dark_path.with_name(dark_path.stem.replace("-dark", "") + "-light.svg")

    dark_path.write_text(build_svg(lines, theme="dark"))
    light_path.write_text(build_svg(lines, theme="light"))

    print(f"Wrote {dark_path} and {light_path} ({len(lines)} rows x {COLUMNS} cols)")


if __name__ == "__main__":
    main()
