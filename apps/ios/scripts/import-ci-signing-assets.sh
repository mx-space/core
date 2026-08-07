#!/usr/bin/env bash

set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_ENV:?GITHUB_ENV is required}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID is required}"
: "${SPACE_BUNDLE_ID:?SPACE_BUNDLE_ID is required}"
: "${DIST_CERT_P12:?DIST_CERT_P12 is required}"
: "${DIST_CERT_PASSWORD:?DIST_CERT_PASSWORD is required}"
: "${APP_PROFILE_BASE64:?APP_PROFILE_BASE64 is required}"

keychain_path="$RUNNER_TEMP/ci.keychain-db"
keychain_password="$(uuidgen)"
legacy_profiles_directory="$HOME/Library/MobileDevice/Provisioning Profiles"
xcode_profiles_directory="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
profile_path="$RUNNER_TEMP/IOS_APP.mobileprovision"
profile_plist="$RUNNER_TEMP/IOS_APP.plist"

security create-keychain -p "$keychain_password" "$keychain_path"
security set-keychain-settings -lut 21600 "$keychain_path"
security unlock-keychain -p "$keychain_password" "$keychain_path"
security list-keychains -d user -s "$keychain_path" login.keychain-db

printf '%s' "$DIST_CERT_P12" | base64 --decode > "$RUNNER_TEMP/dist.p12"
security import "$RUNNER_TEMP/dist.p12" \
  -k "$keychain_path" \
  -P "$DIST_CERT_PASSWORD" \
  -T /usr/bin/codesign
security set-key-partition-list \
  -S apple-tool:,apple: \
  -s \
  -k "$keychain_password" \
  "$keychain_path" > /dev/null

signing_identities="$(security find-identity -v -p codesigning "$keychain_path")"
printf '%s\n' "$signing_identities"
if ! grep -q 'Apple Distribution:' <<< "$signing_identities"; then
  echo 'The imported PKCS#12 archive does not contain an Apple Distribution identity.' >&2
  exit 1
fi

printf '%s' "$APP_PROFILE_BASE64" | base64 --decode > "$profile_path"
security cms -D -i "$profile_path" > "$profile_plist"

profile_uuid="$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$profile_plist")"
profile_name="$(/usr/libexec/PlistBuddy -c 'Print :Name' "$profile_plist")"
profile_team_id="$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$profile_plist")"
profile_application_id="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:application-identifier' "$profile_plist")"
profile_push_environment="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:aps-environment' "$profile_plist" 2>/dev/null || true)"
get_task_allow="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:get-task-allow' "$profile_plist" 2>/dev/null || printf 'false')"

if [[ ! "$profile_uuid" =~ ^[0-9A-Fa-f-]{36}$ ]]; then
  echo 'The Space provisioning profile has an invalid UUID.' >&2
  exit 1
fi
if [[ "$profile_team_id" != "$APPLE_TEAM_ID" ]]; then
  echo "The Space profile belongs to team $profile_team_id, expected $APPLE_TEAM_ID." >&2
  exit 1
fi
if [[ "$profile_application_id" != "$APPLE_TEAM_ID.$SPACE_BUNDLE_ID" ]]; then
  echo "The profile application identifier $profile_application_id does not match $SPACE_BUNDLE_ID." >&2
  exit 1
fi
if [[ "$profile_push_environment" != 'production' ]]; then
  echo 'The Space App Store profile must include the production APNs entitlement.' >&2
  exit 1
fi
if [[ "$get_task_allow" != 'false' ]]; then
  echo 'The Space profile is a development profile; an App Store profile is required.' >&2
  exit 1
fi
if /usr/libexec/PlistBuddy -c 'Print :ProvisionedDevices' "$profile_plist" > /dev/null 2>&1; then
  echo 'The Space profile contains registered devices; an App Store profile is required.' >&2
  exit 1
fi
if /usr/libexec/PlistBuddy -c 'Print :ProvisionsAllDevices' "$profile_plist" > /dev/null 2>&1; then
  echo 'The Space profile is an enterprise profile; an App Store profile is required.' >&2
  exit 1
fi

mkdir -p "$legacy_profiles_directory" "$xcode_profiles_directory"
cp "$profile_path" "$legacy_profiles_directory/$profile_uuid.mobileprovision"
cp "$profile_path" "$xcode_profiles_directory/$profile_uuid.mobileprovision"
{
  printf 'IOS_APP_PROFILE_NAME=%s\n' "$profile_name"
  printf 'IOS_APP_PROFILE_UUID=%s\n' "$profile_uuid"
} >> "$GITHUB_ENV"

printf 'Installed App Store profile %s for %s (%s).\n' "$profile_name" "$SPACE_BUNDLE_ID" "$profile_uuid"
