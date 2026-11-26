#!/usr/bin/env python3
"""Inject a native Android widget into the ephemeral Capacitor Preview project.
This script only edits generated Android files in the GitHub Actions workspace.
It never changes the package id or original/main app.
"""
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET

root = Path("android/app/src/main")
assert root.exists(), "Capacitor Android project has not been generated"
source = Path("android-widget")
assert source.exists(), "Widget source files missing"
dest_java = root / "java/lu/marcio/worktimepro/preview"
dest_java.mkdir(parents=True, exist_ok=True)
for item in (source / "src/main/java/lu/marcio/worktimepro/preview").glob("*.java"):
    shutil.copy2(item, dest_java / item.name)
for resource in (source / "res").rglob("*.xml"):
    target = root / "res" / resource.relative_to(source / "res")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(resource, target)

# Local Capacitor plugin must be registered before super.onCreate.
activity = dest_java / "MainActivity.java"
assert activity.exists(), "MainActivity generated in an unexpected location"
original = activity.read_text()
assert "extends BridgeActivity" in original, "Unexpected MainActivity implementation"
activity.write_text("""package lu.marcio.worktimepro.preview;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkTimeWidgetPlugin.class);
        registerPlugin(WorkTimePrintPlugin.class);
        registerPlugin(WorkTimeBiometricPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
""")

manifest_file = root / "AndroidManifest.xml"
NS = "http://schemas.android.com/apk/res/android"
ET.register_namespace("android", NS)
tree = ET.parse(manifest_file)
manifest = tree.getroot()
# Android 13+: notifications are only displayed after the user grants permission
# through the system settings. Keep the preference disabled by default.
permission = f"{{{NS}}}name"
if not any(el.get(permission) == "android.permission.POST_NOTIFICATIONS"
           for el in manifest.findall("uses-permission")):
    ET.SubElement(manifest, "uses-permission", {
        permission: "android.permission.POST_NOTIFICATIONS"
    })
if not any(el.get(permission) == "android.permission.USE_BIOMETRIC"\n           for el in manifest.findall("uses-permission")):\n    ET.SubElement(manifest, "uses-permission", {permission: "android.permission.USE_BIOMETRIC"})\napp = manifest.find("application")
assert app is not None, "AndroidManifest has no application node"
# Reuse the same WT blue identity across the launcher and widget.
# Adaptive icons are overridden in mipmap-anydpi-v26; legacy icons remain
# available as Capacitor fallback on older Android versions.
app.set(f"{{{NS}}}icon", "@mipmap/ic_launcher")
app.set(f"{{{NS}}}roundIcon", "@mipmap/ic_launcher_round")
for asset in ("ic_launcher.xml", "ic_launcher_round.xml"):
    assert (root / "res/mipmap-anydpi-v26" / asset).is_file(), (
        "WT adaptive launcher resource missing: " + asset
    )
assert (root / "res/drawable/wt_logo_badge.xml").is_file(), "WT widget badge missing"
name_key = f"{{{NS}}}name"
if not any(el.get(name_key) == ".WorkTimeWidgetProvider" for el in app.findall("receiver")):
    receiver = ET.SubElement(app, "receiver", {
        name_key: ".WorkTimeWidgetProvider",
        f"{{{NS}}}enabled": "true",
        f"{{{NS}}}exported": "false"
    })
    filters = ET.SubElement(receiver, "intent-filter")
    ET.SubElement(filters, "action", {name_key: "android.appwidget.action.APPWIDGET_UPDATE"})
    ET.SubElement(receiver, "meta-data", {
        name_key: "android.appwidget.provider",
        f"{{{NS}}}resource": "@xml/worktime_widget_info"
    })
tree.write(manifest_file, encoding="utf-8", xml_declaration=True)
print("Native WorkTime widget added to Preview APK; original app remains unchanged.")
