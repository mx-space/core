## TL;DR

Sponsor import now accepts CSV as well as the GitHub API, and article translations keep tags and image captions in the glossary.

## Highlights

You can now import GitHub Sponsors from a CSV file as well as from the GitHub API. The admin import modal has a source switch: keep the API path, or choose CSV to paste rows or upload a file with github_id, email, handle, months, and note. Each row is matched to an existing reader by GitHub account id, email, or handle. The CSV tab can copy an AI prompt that pulls sponsors via GraphQL and writes the file.

Translated articles no longer rewrite tags on each post. The original tag stays on the article, and localized names come from translation entries in the glossary, so one tag translation covers every article that uses it. Image and gallery captions, plus alt text, now join the Lexical translation walk, so captions and alt attributes are translated with the body instead of being left in the source language.

## Changes

### Features

- Import GitHub Sponsors from CSV (paste or file) in addition to the GitHub API; rows match readers by GitHub id, email, or handle ([2caa5ef](https://github.com/mx-space/core/commit/2caa5efe88650241b3f929779849a6b65767bffb))
- Translate tags through glossary entries instead of per-article AI, and include image and gallery captions plus alt text in Lexical translation ([#2816](https://github.com/mx-space/core/pull/2816))

## Upgrade Notes

- `POST /membership/sponsors/github/import` is now `POST /membership/sponsors/import`. Bundled admin already uses the new path; update any custom scripts that called the old route.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.7.0...v14.8.0
