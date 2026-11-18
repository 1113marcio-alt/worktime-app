#!/usr/bin/env python3
"""Apply user-owned signing config only to the ephemeral generated Android project.

Never store passwords, keys, keystores or their base64 representation in git.
The preview package ID stays lu.marcio.worktimepro.preview.
"""
from pathlib import Path
import os

path = Path("android/app/build.gradle")
if not path.is_file():
    raise SystemExit("Android Capacitor build.gradle not found")
required = (
    "WORKTIME_KEYSTORE_PATH",
    "WORKTIME_KEYSTORE_PASSWORD",
    "WORKTIME_KEY_ALIAS",
    "WORKTIME_KEY_PASSWORD",
)
if any(not os.environ.get(key) for key in required):
    raise SystemExit("Signing secrets incomplete; signed release aborted")
if not Path(os.environ["WORKTIME_KEYSTORE_PATH"]).is_file():
    raise SystemExit("Signing file absent; signed release aborted")
content = path.read_text(encoding="utf-8")
if "worktimePreviewRelease" in content:
    raise SystemExit("Signing already applied; refusing duplicate block")
if "android {" not in content or "buildTypes" not in content:
    raise SystemExit("Unexpected Capacitor Gradle structure")

# Only literal environment variable names go into build.gradle, never their values.
content += """
// Configured solely for the temporary GitHub Actions workspace.
// Credentials come from GitHub Actions encrypted secrets at build time.
android {
    signingConfigs {
        worktimePreviewRelease {
            storeFile file(System.getenv('WORKTIME_KEYSTORE_PATH'))
            storePassword System.getenv('WORKTIME_KEYSTORE_PASSWORD')
            keyAlias System.getenv('WORKTIME_KEY_ALIAS')
            keyPassword System.getenv('WORKTIME_KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.worktimePreviewRelease
        }
    }
}
"""
path.write_text(content, encoding="utf-8")
print("Release signing configured using environment variables; no secrets printed.")
