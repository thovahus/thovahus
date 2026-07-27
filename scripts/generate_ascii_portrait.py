#!/usr/bin/env python3
"""Render a photo as an animated ASCII-art SVG (dark + light variants).

Usage: python3 scripts/generate_ascii_portrait.py <photo> [output-dir]
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

GLYPHS = "@%#*+=-:. "  # dark -> light
COLUMNS = 100
FONT_SIZE = 6.2
LINE_HEIGHT = FONT_SIZE
CHAR_WIDTH = FONT_SIZE * 0.6
CHAR_ASPECT = 0.52  # terminal cells are taller than wide

THEMES = {
    "dark": {"bg": "#0d1117", "fg": "#39d353", "cursor": "#196c2e"},
    "light": {"bg": "#ffffff", "fg": "#216e39", "cursor": "#9be9a8"},
}


def photo_to_ascii_lines(photo_path, columns=COLUMNS):
    image = ImageOps.autocontrast(Image.open(photo_path).convert("L"), cutoff=1)
    width, height = image.size
    rows = max(1, round(columns * height * CHAR_ASPECT / width))
    image = image.resize((columns, rows))

    pixels = list(image.getdata())
    last_glyph = len(GLYPHS) - 1
    return [
        "".join(GLYPHS[int(p / 255 * last_glyph)] for p in pixels[row * columns:(row + 1) * columns])
        for row in range(rows)
    ]


def escape_xml(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_svg(lines, theme_name):
    theme = THEMES[theme_name]
    width = round(max(len(line) for line in lines) * CHAR_WIDTH + 24)
    height = round(len(lines) * LINE_HEIGHT + 24)
    cursor_y = 16 + len(lines) * LINE_HEIGHT
    cursor_delay = round(len(lines) * 0.045 + 0.2, 3)

    rows_svg = "\n".join(
        f'  <text x="12" y="{16 + i * LINE_HEIGHT:.2f}" class="row" '
        f'style="animation-delay:{round(i * 0.045, 3)}s">{escape_xml(line)}</text>'
        for i, line in enumerate(lines)
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <style>
    text {{
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: {FONT_SIZE}px;
      fill: {theme['fg']};
      white-space: pre;
      opacity: 0;
    }}
    .row {{ animation: reveal 0.5s ease-out forwards; }}
    @keyframes reveal {{
      from {{ opacity: 0; transform: translateX(-6px); }}
      to {{ opacity: 1; transform: translateX(0); }}
    }}
    .cursor {{
      fill: {theme['cursor']};
      animation: blink 1s step-end infinite;
      animation-delay: {cursor_delay}s;
    }}
    @keyframes blink {{
      0%, 100% {{ opacity: 1; }}
      50% {{ opacity: 0; }}
    }}
  </style>
  <rect width="100%" height="100%" fill="{theme['bg']}" />
{rows_svg}
  <text x="12" y="{cursor_y:.2f}" class="cursor">▍</text>
</svg>
"""


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    lines = photo_to_ascii_lines(sys.argv[1])

    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("assets")
    out_dir.mkdir(parents=True, exist_ok=True)

    for theme_name in THEMES:
        out_path = out_dir / f"ascii-portrait-{theme_name}.svg"
        out_path.write_text(render_svg(lines, theme_name))
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
