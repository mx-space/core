# Comment Reader Ref Migration

This migration converts eligible historical comments from snapshot-based logged-in identity to `readerId`-based identity.

## Required Dump

Dump the full `comments` collection before running the migration:

```bash
mkdir -p ./artifacts/comment-dumps
mongodump \
  --uri "$MONGO_URI" \
  --collection comments \
  --archive="./artifacts/comment-dumps/comments-$(date +%Y%m%d-%H%M%S).archive.gz" \
  --gzip
```

Keep the archive for:
- regression comparison after migration
- rollback support
- sampling unmatched comments for manual verification

## Migration Rule

Only comments that satisfy all of the following are rewritten:
- `readerId` is missing
- `mail` exists
- `source` exists
- `mail + source` resolves to exactly one Better Auth reader via `readers + accounts`

When a unique match is found, the migration:
- sets `readerId`
- unsets `author`
- unsets `mail`
- unsets `avatar`
- unsets `url`
- unsets `source`

When there are zero or multiple matches, the comment is left unchanged.

## Suggested Operator Flow

1. Dump `comments`
2. Run the migration in staging
3. Compare a sample of migrated and skipped comments against the dump
4. Run the migration in production
