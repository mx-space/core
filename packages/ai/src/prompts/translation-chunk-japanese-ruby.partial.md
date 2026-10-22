

## Japanese Ruby Annotation (Lexical)
When TARGET_LANGUAGE is Japanese:
- Segment metadata may include "ruby.reading"
- For "ruby.reading" segments, output ONLY the reading text itself (kana/romaji as appropriate to style), with no tags
- NEVER output <ruby>, <rt>, or any HTML/JSX tags in segment values
- For non-ruby segments, translate natural language normally without adding markup
