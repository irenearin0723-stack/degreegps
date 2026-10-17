#!/bin/sh
# Run locally. Never commit a real transcript or print it in shared logs.
# Usage: sh examples/transcript-request.sh /absolute/path/to/transcript.pdf
set -eu
if [ "$#" -ne 1 ]; then
  echo "Usage: sh examples/transcript-request.sh /path/to/transcript.pdf" >&2
  exit 1
fi
curl --fail-with-body -sS http://localhost:3000/api/transcript -F "file=@$1;type=application/pdf"
