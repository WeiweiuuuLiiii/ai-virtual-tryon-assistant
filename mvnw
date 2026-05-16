#!/bin/sh
# Maven Wrapper — downloads Maven automatically, no global install required.
set -e

WRAPPER_PROPS=".mvn/wrapper/maven-wrapper.properties"

if [ ! -f "$WRAPPER_PROPS" ]; then
  echo "ERROR: $WRAPPER_PROPS not found. Run this script from the project root." >&2
  exit 1
fi

# Read the distribution URL from properties file
DIST_URL=$(grep "^distributionUrl=" "$WRAPPER_PROPS" | cut -d= -f2-)
if [ -z "$DIST_URL" ]; then
  echo "ERROR: distributionUrl not set in $WRAPPER_PROPS" >&2
  exit 1
fi

# Derive directory name: apache-maven-3.9.6-bin.zip -> apache-maven-3.9.6
DIST_FILENAME="${DIST_URL##*/}"
DIST_DIR="${DIST_FILENAME%-bin.zip}"

# Cache location (same as official Maven wrapper: ~/.m2/wrapper/dists/)
CACHE_DIR="${HOME}/.m2/wrapper/dists/${DIST_DIR}"
MVN_CMD="${CACHE_DIR}/bin/mvn"

# Download and unpack if not already cached
if [ ! -f "${MVN_CMD}" ]; then
  echo "Downloading Maven ${DIST_DIR} (one-time setup)..."
  mkdir -p "${HOME}/.m2/wrapper/dists"
  TMP_ZIP="${HOME}/.m2/wrapper/dists/${DIST_FILENAME}"

  if command -v curl > /dev/null 2>&1; then
    curl -fL --progress-bar "${DIST_URL}" -o "${TMP_ZIP}"
  elif command -v wget > /dev/null 2>&1; then
    wget -q --show-progress "${DIST_URL}" -O "${TMP_ZIP}"
  else
    echo "ERROR: Neither curl nor wget is available. Cannot download Maven." >&2
    exit 1
  fi

  echo "Unpacking Maven..."
  unzip -q "${TMP_ZIP}" -d "${HOME}/.m2/wrapper/dists"
  rm -f "${TMP_ZIP}"
  echo "Maven ready."
fi

# Verify the executable exists after download
if [ ! -f "${MVN_CMD}" ]; then
  echo "ERROR: Maven executable not found at ${MVN_CMD} after download." >&2
  exit 1
fi

chmod +x "${MVN_CMD}"
exec "${MVN_CMD}" "$@"
