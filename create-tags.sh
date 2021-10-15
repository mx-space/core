set -e

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "master" ]]; then
  echo 'current branch not on master, abort'
  exit 1
fi

tag=v$(json -f package.json version)
yarn changelog
git add .
git commit -a -m "release: $tag" &>/dev/null
git push
git tag -a "$tag" -m "Release $tag" &>/dev/null
git push --tags
