#!/usr/bin/env bash
# Launches the Linux builds in dist/ under a virtual display and checks they stay up.
# Mimics an Ubuntu 24.04 desktop (Zorin OS 18, Mint 22…): unprivileged user namespaces
# restricted by AppArmor, which is what stops Electron's sandbox.
# Usage (on Ubuntu, after npm run build:linux): bash scripts/linux-smoke.sh
set -u
cd "$(dirname "$0")/.."

sudo apt-get update -qq
sudo apt-get install -y -qq xvfb libfuse2t64 >/dev/null || sudo apt-get install -y -qq xvfb libfuse2 >/dev/null

echo "kernel.apparmor_restrict_unprivileged_userns before: $(sysctl -n kernel.apparmor_restrict_unprivileged_userns 2>/dev/null || echo n/a)"
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=1 || true

failed=0

# Runs a command for 20 s under Xvfb; passes if it is still running then.
smoke() {
  local name="$1"
  shift
  local log
  log="$(mktemp)"
  echo "::group::$name"
  xvfb-run -a "$@" >"$log" 2>&1 &
  local pid=$!
  sleep 20
  if kill -0 "$pid" 2>/dev/null; then
    echo "PASS: $name is running after 20 s"
    pkill -f -i craftpages 2>/dev/null
    kill "$pid" 2>/dev/null
  else
    wait "$pid"
    echo "FAIL: $name exited with code $?"
    failed=1
  fi
  echo "--- output ---"
  head -c 6000 "$log"
  echo "::endgroup::"
  sleep 2
}

appimage="$(ls dist/*.AppImage | head -1)"
chmod +x "$appimage"
smoke "AppImage" "$appimage"

sudo apt-get install -y -qq "./$(ls dist/*.deb | head -1)" >/dev/null
smoke "deb" craftpages

exit $failed
