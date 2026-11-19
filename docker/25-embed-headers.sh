#!/bin/sh
set -eu

CONF="/etc/nginx/conf.d/default.conf"
if [ ! -f "$CONF" ]; then
  exit 0
fi

ORIGINS="${EMBED_FRAME_ANCESTORS:-'none'}"
ORIGINS="$(printf '%s' "$ORIGINS" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

if [ -z "$ORIGINS" ] || [ "$ORIGINS" = "'none'" ]; then
  exit 0
fi

if ! printf '%s' "$ORIGINS" | grep -Eq "^[A-Za-z0-9' :./_*+-]+$"; then
  echo "Warning: Invalid EMBED_FRAME_ANCESTORS value; keeping default frame-ancestors 'none'." >&2
  exit 0
fi

TMP_CONF="$(mktemp)"
if [ "$ORIGINS" = "'self'" ]; then
  sed \
    -e "s|frame-ancestors 'none';|frame-ancestors ${ORIGINS};|g" \
    -e 's|add_header X-Frame-Options "DENY" always;|add_header X-Frame-Options "SAMEORIGIN" always;|g' \
    "$CONF" > "$TMP_CONF"
else
  sed \
    -e "s|frame-ancestors 'none';|frame-ancestors ${ORIGINS};|g" \
    -e '/add_header X-Frame-Options "DENY" always;/d' \
    "$CONF" > "$TMP_CONF"
fi

cat "$TMP_CONF" > "$CONF"
rm -f "$TMP_CONF"
