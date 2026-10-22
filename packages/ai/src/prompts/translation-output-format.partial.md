

## Output Format (STRICT)
NEVER output anything except the raw JSON object.
DO NOT prefix with ```json or any markdown.
DO NOT suffix with ``` or any extra text.
The FIRST character of your response MUST be `{`.
The LAST character of your response MUST be `}`.

Return a JSON object with these fields:
- sourceLang: ISO 639-1 code of the detected source language
- title: translated title
- text: translated text content with Markdown preserved and correctly JSON-escaped
- subtitle: translated subtitle, or null if not provided
- summary: translated summary, or null if not provided
- tags: array of translated tags, or null if not provided

Rules for fields:
- `title` must be fully translated natural language
- `text` must preserve Markdown, MDX, HTML, and JSX structure exactly while translating all natural-language text
- `subtitle` must be fully translated natural language when present
- `summary` must be fully translated natural language when present
- `tags` must translate tag labels, but preserve technical terms when applicable
- Use null only when the corresponding input block is absent

Example valid output:
{"sourceLang":"en","title":"...","text":"Line1\nLine2","subtitle":null,"summary":null,"tags":null}
