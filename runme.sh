#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: ./runme.sh [--demo] [--port PORT] [--no-open]

  --demo       Start the sample dashboard without live search
  --port PORT  Use a different local port (default 8000)
  --no-open    Print the address without opening a browser
  -h, --help   Show this help

For live search, sign in to your agent CLI and select it under Run with.
Claude Code is the default. Press Ctrl+C in this terminal to stop.
HELP
}

demo=false
open=true
npm_args=(start --)

while (( $# )); do
  case "$1" in
    --demo) demo=true; shift ;;
    --no-open) open=false; shift ;;
    --port)
      if [[ $# -lt 2 || ! $2 =~ ^[0-9]{1,5}$ ]] || (( 10#$2 < 1 || 10#$2 > 65535 )); then
        printf '%s\n' 'Use --port followed by a number from 1 to 65535.' >&2
        exit 2
      fi
      export PORT="$2"
      shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null || ! command -v npm >/dev/null ||
    ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 20) ? 0 : 1)'; then
  printf '%s\n' 'Install Node.js 22.20 or later with npm, then run this script again.' 'https://nodejs.org/en/download' >&2
  exit 1
fi

if "$demo"; then
  npm_args+=(--demo)
elif [[ -z ${CLAUDE_ACP_EXECUTABLE:-} ]] && ! command -v claude >/dev/null && ! command -v claude-agent-acp >/dev/null; then
  printf '%s\n' 'For the default live harness, install and sign in to Claude Code.' \
    'You can also choose another configured harness or select Try a demo.'
fi
if "$open"; then
  npm_args+=(--open)
fi

exec npm "${npm_args[@]}"
