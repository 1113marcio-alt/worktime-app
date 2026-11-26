#!/usr/bin/env python3
"""Use monotonically increasing Actions run numbers for the Preview app."""
from pathlib import Path
import os
import re

activity = Path("android/app/src/main/java/lu/marcio/worktimepro/preview/MainActivity.java")
gradle = Path("android/app/build.gradle")
plugin = activity.parent / "WorkTimeUpdatePlugin.java"
assert activity.is_file() and gradle.is_file() and plugin.is_file(), "Missing Preview update inputs"
run = int(os.environ["GITHUB_RUN_NUMBER"])
assert 1 <= run <= 2099900000, "Invalid Android version number"
code = 100000 + run
text = activity.read_text(encoding="utf-8")
marker = "        registerPlugin(WorkTimeReceiptPlugin.class);"
registration = "        registerPlugin(WorkTimeUpdatePlugin.class);"
if registration not in text:
    assert text.count(marker) == 1, "Unexpected activity"
    activity.write_text(text.replace(marker, marker + "\n" + registration), encoding="utf-8")
build = gradle.read_text(encoding="utf-8")
build, n = re.subn(r"(?m)^([ \t]*)versionCode[ \t]+\d+[ \t]*$", lambda m: m[1] + "versionCode " + str(code), build)
assert n == 1, "Unexpected versionCode declaration"
build, n = re.subn(r'''(?m)^([ \t]*)versionName[ \t]+["'][^"'\r\n]+["'][ \t]*$''', lambda m: m[1] + 'versionName "3.0-preview.' + str(run) + '"', build)
assert n == 1, "Unexpected versionName declaration"
gradle.write_text(build, encoding="utf-8")
print("Preview versionCode:", code)
