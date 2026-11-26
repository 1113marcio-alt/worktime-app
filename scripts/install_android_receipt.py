#!/usr/bin/env python3
"""Install the bundled offline receipt OCR plugin into the generated Preview project."""
from pathlib import Path

activity = Path("android/app/src/main/java/lu/marcio/worktimepro/preview/MainActivity.java")
gradle = Path("android/app/build.gradle")
plugin = activity.parent / "WorkTimeReceiptPlugin.java"
assert activity.is_file() and gradle.is_file() and plugin.is_file(), "Missing generated Preview OCR inputs"
text = activity.read_text(encoding="utf-8")
marker = "        registerPlugin(WorkTimeReminderPlugin.class);"
registration = "        registerPlugin(WorkTimeReceiptPlugin.class);"
if registration not in text:
    assert text.count(marker) == 1, "Unexpected Preview activity"
    text = text.replace(marker, marker + "\n" + registration)
    activity.write_text(text, encoding="utf-8")
dependency = "implementation 'com.google.mlkit:text-recognition:16.0.1'"
build = gradle.read_text(encoding="utf-8")
if dependency not in build:
    gradle.write_text(build + "\n\ndependencies {\n    " + dependency + "\n}\n", encoding="utf-8")
print("Bundled receipt OCR added to Preview.")
