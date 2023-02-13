#!env bash
REPO="${REPO:-mx-admin}"
ORG="${ORG:-mx-space}"

FULL_REPO="${ORG}/${REPO}"

VERSION="${VERSION:-3.21.0}"

URL=$(curl -s -X GET "https://api.github.com/repos/${FULL_REPO}/releases/tags/v${VERSION}" | jq -r '.assets[].browser_download_url')
echo $URL
wget $URL -o /tmp/mx-admin-$VERSION.zip
unzip /tmp/mx-admin-$VERSION.zip -d /tmp/mx-admin-$VERSION
