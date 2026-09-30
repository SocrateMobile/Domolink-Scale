#!/usr/bin/env python3
"""Automated release helper script for Domolink-Scale.

Usage:
    export GITHUB_TOKEN="your_token"
    python3 scripts/release.py 1.2.2 "Notes de la mise à jour..."
"""
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.request

REPO_OWNER = "SocrateMobile"
REPO_NAME = "Domolink-Scale"
GITHUB_REPO = f"{REPO_OWNER}/{REPO_NAME}"

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MANIFEST_PATH = os.path.join(ROOT_DIR, "custom_components", "domolink_scale", "manifest.json")
README_PATH = os.path.join(ROOT_DIR, "README.md")


def get_token() -> str:
    """Retrieve GitHub token from environment or git remote."""
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    try:
        remote = (
            subprocess.check_output(
                ["git", "remote", "get-url", "origin"],
                cwd=ROOT_DIR,
                text=True,
            )
            .strip()
        )
        match = re.search(r":([^:@]+)@github\.com", remote)
        if match:
            return match.group(1)
    except Exception:
        pass
    print("Error: GITHUB_TOKEN environment variable is not set.")
    sys.exit(1)


def update_version_files(new_ver: str) -> None:
    """Update version in manifest.json (Single Source of Truth) and README.md badge."""
    # 1. manifest.json
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["version"] = new_ver
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"Updated {MANIFEST_PATH} -> {new_ver}")

    # 2. README.md badge
    if os.path.exists(README_PATH):
        with open(README_PATH, "r", encoding="utf-8") as f:
            readme_content = f.read()
        readme_content = re.sub(
            r"badge/version-[^-\s]+-blue\.svg",
            f"badge/version-{new_ver}-blue.svg",
            readme_content,
        )
        with open(README_PATH, "w", encoding="utf-8") as f:
            f.write(readme_content)
        print(f"Updated {README_PATH} badge -> {new_ver}")


def run_cmd(cmd: list[str]) -> None:
    """Run shell command and check status."""
    print(f"Running: {' '.join(cmd)}")
    subprocess.check_call(cmd, cwd=ROOT_DIR)


def create_github_release(new_ver: str, release_notes: str, token: str) -> None:
    """Create GitHub release via API and attach latest tag."""
    tag = f"v{new_ver}" if not new_ver.startswith("v") else new_ver
    url = f"https://api.github.com/repos/{GITHUB_REPO}/releases"

    payload = {
        "tag_name": tag,
        "target_commitish": "main",
        "name": f"Domolink-Scale {tag} (Latest)",
        "body": release_notes,
        "draft": False,
        "prerelease": False,
        "make_latest": "true",
    }

    ctx = ssl.create_default_context()
    try:
        import certifi

        ctx.load_verify_locations(certifi.where())
    except Exception:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "ReleaseScript",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            print(f"Release {tag} created successfully! HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"Failed to create release: {e.code} - {e.read().decode('utf-8')}")
        sys.exit(1)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/release.py <version> [release_notes]")
        sys.exit(1)

    new_ver = sys.argv[1].lstrip("v")
    notes = sys.argv[2] if len(sys.argv) > 2 else f"Release v{new_ver}"
    token = get_token()

    print(f"--- Preparing release v{new_ver} for {GITHUB_REPO} ---")

    update_version_files(new_ver)

    run_cmd(["git", "add", MANIFEST_PATH, README_PATH])
    run_cmd(["git", "commit", "-m", f"chore: release v{new_ver}"])
    run_cmd(["git", "push", "origin", "main"])

    run_cmd(["git", "tag", "-a", f"v{new_ver}", "-m", f"Release v{new_ver}"])
    run_cmd(["git", "push", "origin", f"v{new_ver}"])

    create_github_release(new_ver, notes, token)
    print(f"--- Successfully published v{new_ver}! ---")


if __name__ == "__main__":
    main()
