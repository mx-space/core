yarn version --no-git-tag-version
tag=v$(json -f package.json version)
git add .
git commit -a -m "release: $tag" &>/dev/null
git push
git tag -a "$tag" -m "Release $tag" &>/dev/null
git push --tags
