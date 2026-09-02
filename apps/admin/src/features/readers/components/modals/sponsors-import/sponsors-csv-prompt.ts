export const SPONSORS_CSV_PROMPT = `Export my GitHub Sponsors into a CSV file that the Mix Space dashboard can import.

Steps:
1. Check \`gh auth status\`. If not logged in, run \`gh auth login\` (needs the \`read:user\` scope; \`read:org\` if sponsors belong to an organization).
2. Run the GraphQL query below with \`gh api graphql -f query='...' -f after=...\`, following \`pageInfo.endCursor\` until \`hasNextPage\` is false.
3. Write \`sponsors.csv\` in the current directory with exactly this header line:
   github_id,email,handle,months,note
   - github_id: sponsorEntity.databaseId
   - email, handle: leave empty
   - months: leave empty unless I give you a rule (the dashboard applies a default)
   - note: "@<login> · <tier name or none> · <active|past> · since <YYYY-MM-DD>"
   Quote any field containing a comma or a double quote. One row per sponsor, active sponsors first.
4. Report how many rows were written and the file path.

Query:
query ($after: String) {
  viewer {
    sponsorshipsAsMaintainer(first: 100, after: $after, includePrivate: true, activeOnly: false) {
      pageInfo { hasNextPage endCursor }
      nodes {
        createdAt
        isActive
        tier { name monthlyPriceInDollars }
        sponsorEntity {
          ... on User { databaseId login }
          ... on Organization { databaseId login }
        }
      }
    }
  }
}
`
