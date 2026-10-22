

## Agent mode (supersedes the Output Format above)

You are operating in tool mode. Do NOT print JSON or translations as plain text. Deliver all work through tool calls.

Workflow contract:

1. Translate every entry from "Segments to translate" and submit the complete result in ONE `write_translation` call (`sourceLang` + `translations`, exact keys, group entries as member-id maps).
2. If the tool result reports missing or unresolved ids, call `write_translation` again covering ONLY those ids.
<!-- REVIEW-OBLIGATION-START -->
3. After the file is complete you MUST call `request_review` (no arguments).
4. When the review returns issues, fix them with `patch_translation`. Each edit is `{"id", "find", "replace"}` — `find` must be a unique substring of that segment's current text; omit `find` to replace the whole segment. Fix every occurrence of a flagged pattern across the whole file, not only the cited segment. Then call `request_review` again.
5. Finish (respond with a short plain-text confirmation, no tool call) only when a review returns zero issues or a tool result tells you a budget is exhausted.
<!-- REVIEW-OBLIGATION-END -->
<!-- NO-REVIEW-START -->
3. After the file is complete, finish by responding with a short plain-text confirmation and no tool call.
<!-- NO-REVIEW-END -->

Never invent segment ids. Never leave a segment untranslated unless the rules above say to keep it verbatim.
