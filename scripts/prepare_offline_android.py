#!/usr/bin/env python3
"""Prepare bundled Android WebView assets for fully offline operation.

Only touches generated www/ files, not the source PWA used on the web.
The CSS must be generated locally by Tailwind CLI before this script runs.
"""
from pathlib import Path
import re

root = Path("www")
html_path = root / "index.html"
css_path = root / "tailwind.generated.css"
sw_path = root / "sw.js"
if not html_path.is_file() or not css_path.is_file() or css_path.stat().st_size < 5000:
    raise SystemExit("Missing or suspiciously small compiled offline Tailwind stylesheet")

html = html_path.read_text(encoding="utf-8")
cdn = '<script src="https://cdn.tailwindcss.com"></script>'
if html.count(cdn) != 1:
    raise SystemExit("Tailwind CDN marker changed; refusing an incomplete offline build")
html = html.replace(cdn, "")

# Drop the old runtime tailwind.config JS, which would otherwise throw when
# the CDN was removed. tailwind.config.cjs now supplies its build-time values.
html, count = re.subn(
    r"<script>\s*tailwind\.config\s*=.*?</script>",
    "",
    html,
    count=1,
    flags=re.DOTALL,
)
if count != 1:
    raise SystemExit("Runtime Tailwind config marker changed")
base_link = '<link rel="stylesheet" href="pro-ui.css" />'
if html.count(base_link) != 1:
    raise SystemExit("Local stylesheet anchor missing")
html = html.replace(
    base_link,
    '<link rel="stylesheet" href="tailwind.generated.css" />\n  ' + base_link,
)
if "cdn.tailwindcss.com" in html:
    raise SystemExit("CDN reference remains after offline preparation")
html_path.write_text(html, encoding="utf-8")

# The source SW supports a remote web PWA. Add the bundled CSS only in
# generated Android assets; never cache an absent file on the hosted PWA.
if sw_path.is_file():
    sw = sw_path.read_text(encoding="utf-8")
    needle = "'./wt-pin.js'"
    if sw.count(needle) != 1:
        raise SystemExit("Service worker asset anchor missing")
    sw = sw.replace(needle, needle + ", './tailwind.generated.css'")
    sw = sw.replace("worktime-pro-v2-1-pin-safety-20261126",
                    "worktime-pro-v2-offline-20261125")
    sw_path.write_text(sw, encoding="utf-8")

print("Offline Android assets prepared: local Tailwind CSS; no runtime CDN needed.")
