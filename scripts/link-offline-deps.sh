#!/bin/bash
# Build an offline node_modules "symlink farm" for this project.
# No egress in this container, so we resolve third-party packages by symlinking the
# packages baked into /opt/hermes/node_modules into the project's own node_modules.
# Real directories (vendored code we own) are created inside node_modules and are
# NEVER overwritten by the linker.
set -euo pipefail

PROJ="${1:?usage: link-offline-deps.sh <project-dir>}"
SRC="/opt/hermes/node_modules"
DST="$PROJ/node_modules"

mkdir -p "$DST/.bin"

# Packages that MUST resolve to the project's own vendored copy, never the baked tree.
# (Vendored Emotion lives in <proj>/vendor/emotion and is linked in below.)
SKIP_RE='^@emotion($|/)|^vendor$|^\.bin$|^\.package-lock'

linked=0
while IFS= read -r entry; do
  name="$(basename "$entry")"
  case "$name" in
    @*) ;;                       # scoped dir -> recurse one level
    *)
      if echo "$name" | grep -qE "$SKIP_RE"; then continue; fi
      target="$DST/$name"
      if [ -L "$target" ] || [ ! -e "$target" ]; then
        ln -sfn "$SRC/$name" "$target"; linked=$((linked+1))
      fi
      ;;
  esac
done < <(find "$SRC" -mindepth 1 -maxdepth 1 -maxdepth 1)

# Scoped packages
for scope_dir in "$SRC"/@*/; do
  scope="$(basename "$scope_dir")"
  case "$scope" in
    @emotion) continue ;;
  esac
  mkdir -p "$DST/$scope"
  for pkg in "$scope_dir"*/; do
    [ -d "$pkg" ] || continue
    pname="$(basename "$pkg")"
    target="$DST/$scope/$pname"
    if [ -L "$target" ] || [ ! -e "$target" ]; then
      ln -sfn "${pkg%/}" "$target"; linked=$((linked+1))
    fi
  done
done

# Binaries
for b in "$SRC/.bin"/*; do
  [ -e "$b" ] || continue
  bn="$(basename "$b")"
  [ -L "$DST/.bin/$bn" ] || [ ! -e "$DST/.bin/$bn" ] && ln -sfn "$b" "$DST/.bin/$bn"
done

# Vendored @emotion (authored in this repo under vendor/emotion)
if [ -d "$PROJ/vendor/emotion" ]; then
  mkdir -p "$DST/@emotion"
  for pkg in "$PROJ/vendor/emotion"/*/; do
    [ -d "$pkg" ] || continue
    ln -sfn "${pkg%/}" "$DST/@emotion/$(basename "$pkg")"
  done
  echo "linked vendored @emotion packages"
fi

# Local workspace alias package
if [ -d "$PROJ/vendor/alias-app" ]; then
  ln -sfn "$PROJ/vendor/alias-app" "$DST/alias-app"
fi

echo "linked $linked packages into $DST"
