#!/usr/bin/env python3
"""Build and verify an offline Apple Silicon bundle using Apple command-line tools."""

import argparse
import filecmp
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
NAME = "Decimal Dungeon"
EXECUTABLE = "DecimalDungeon"
MINIMUM_OS = "13.0"


def run(*command):
    subprocess.run([str(arg) for arg in command], check=True)


def build(web, output, icon):
    if not (web / "index.html").is_file():
        raise SystemExit(f"Missing {web / 'index.html'}")
    if not icon.is_file():
        raise SystemExit(f"Missing square app icon {icon}")
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".dungeon-build-", dir=output) as staging:
        temporary = Path(staging)
        app = temporary / f"{NAME}.app"
        contents = app / "Contents"
        macos = contents / "MacOS"
        assets = contents / "Resources"
        macos.mkdir(parents=True)
        assets.mkdir()
        shutil.copytree(web, assets / "web", ignore=shutil.ignore_patterns(".DS_Store"))
        # Place the module cache outside the source tree; it is never part of the app.
        cache = Path(tempfile.gettempdir()) / "decimal-dungeon-swift-modules"
        run("xcrun", "swiftc", "-swift-version", "6", "-O", "-target", f"arm64-apple-macos{MINIMUM_OS}",
            "-module-cache-path", cache, ROOT / "native/GameView.swift", ROOT / "native/main.swift",
            "-o", macos / EXECUTABLE)
        run("sips", "-s", "format", "icns", icon, "--out", assets / "Dungeon.icns")
        with (contents / "Info.plist").open("wb") as file:
            plistlib.dump({
                "CFBundleDevelopmentRegion": "en",
                "CFBundleDisplayName": NAME,
                "CFBundleExecutable": EXECUTABLE,
                "CFBundleIconFile": "Dungeon.icns",
                "CFBundleIdentifier": "family.decimaldungeon.game",
                "CFBundleInfoDictionaryVersion": "6.0",
                "CFBundleName": NAME,
                "CFBundlePackageType": "APPL",
                "CFBundleShortVersionString": "1.11",
                "CFBundleVersion": "13",
                "LSApplicationCategoryType": "public.app-category.educational-games",
                "LSMinimumSystemVersion": MINIMUM_OS,
                "NSHighResolutionCapable": True,
                "NSPrincipalClass": "NSApplication",
            }, file)
        run("codesign", "--force", "--sign", "-", "--timestamp=none", app)
        run("codesign", "--verify", "--deep", "--strict", app)
        archive = temporary / f"{NAME}.zip"
        run("ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", app, archive)
        extraction = temporary / "transfer-check"
        run("ditto", "-x", "-k", archive, extraction)
        restored = extraction / app.name
        run("codesign", "--verify", "--deep", "--strict", restored)
        if not filecmp.cmp(restored / "Contents/MacOS" / EXECUTABLE, macos / EXECUTABLE, shallow=False):
            raise SystemExit("The executable changed during the transfer check.")
        # Replace only a release built with this app's own identifier. The previous
        # bundle remains recoverable until both verified files have been moved.
        final_app, final_archive = output / app.name, output / archive.name
        previous = temporary / "previous.app"
        if final_app.exists():
            with (final_app / "Contents/Info.plist").open("rb") as file:
                if plistlib.load(file).get("CFBundleIdentifier") != "family.decimaldungeon.game":
                    raise SystemExit(f"Another application already uses {final_app}")
            final_app.rename(previous)
        try:
            app.rename(final_app)
            os.replace(archive, final_archive)
        except OSError:
            if final_app.exists():
                final_app.rename(app)
            if previous.exists():
                previous.rename(final_app)
            raise
    print(f"Ready to play: {final_app}")
    print(f"Ready to transfer: {final_archive}")
    return final_app


def playtest(app):
    with tempfile.TemporaryDirectory(prefix="decimal-dungeon-playtest-") as directory:
        check = Path(directory)
        test = check / "verify-native"
        cache = Path(tempfile.gettempdir()) / "decimal-dungeon-swift-modules"
        run("xcrun", "swiftc", "-swift-version", "6", "-target", f"arm64-apple-macos{MINIMUM_OS}",
            "-module-cache-path", cache, ROOT / "native/GameView.swift", ROOT / "scripts/verify-native.swift",
            "-o", test)
        run(test, app / "Contents/Resources/web/index.html", check / "save", "game", app)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-dir", type=Path, default=ROOT / "web")
    parser.add_argument("--output-dir", type=Path, default=ROOT)
    parser.add_argument("--icon", type=Path, default=ROOT / "web/assets/app-icon.png")
    parser.add_argument("--playtest", action="store_true", help="Play the conquest and decimal practice scenarios, then verify a Finder-style launch using isolated saves.")
    args = parser.parse_args()
    app = build(args.web_dir.resolve(), args.output_dir.resolve(), args.icon.resolve())
    if args.playtest:
        playtest(app)
