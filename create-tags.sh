set -e
tag=v$(json -f package.json version)
yarn changelog
git add .
git commit -a -m "release: $tag" &>/dev/null
git push
git tag -a "$tag" -m "Release $tag" &>/dev/null
git push --tags
