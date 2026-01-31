import { z } from 'zod'
import {
  AI_SUMMARY_MAX_WORDS,
  DEFAULT_SUMMARY_LANG,
  LANGUAGE_CODE_TO_NAME,
} from './ai.constants'
import type { ReasoningEffort } from './runtime/types'

const SUMMARY_SYSTEM = `You are a professional content summarizer.

## Task
Extract a concise summary from the provided text.

## Requirements
- Output MUST be in the target language specified
- Maximum ${AI_SUMMARY_MAX_WORDS} words
- Focus on core meaning, avoid unnecessary details
- Maintain the original tone and style

## Input Format
TARGET_LANGUAGE: Language name

<<<CONTENT
Text to summarize
CONTENT`

const TITLE_AND_SLUG_SYSTEM = `You are a content metadata generator.

## Task
Generate metadata (title, slug, language code, keywords) for the provided text.

## Requirements
- title: Concise, engaging, in the same language as the input text
- slug: SEO-friendly, lowercase, hyphens only, alphanumeric, ALWAYS in English
- lang: ISO 639-1 language code of the input text
- keywords: 3-5 relevant keywords representing main topics

## Input Format
<<<CONTENT
Text content
CONTENT`

const SLUG_SYSTEM = `You are an SEO slug generator.

## Task
Generate an SEO-friendly slug from the provided title.

## Requirements
- Format: lowercase, hyphens to separate words, alphanumeric only
- Language: ALWAYS English (translate if needed)
- Style: concise, include relevant keywords

## Input Format
<<<TITLE
Title text
TITLE`

const COMMENT_SCORE_SYSTEM = `You are a content moderation specialist.

## Task
Analyze the risk level of user-submitted comments.

## Evaluation Criteria
- spam: Spam, scam, advertisement
- toxic: Toxic content, offensive language
- sensitive: Politically sensitive, pornographic, violent, or threatening content
- quality: Overall content quality

## Scoring
1-10 scale where higher = more dangerous

## Input Format
<<<COMMENT
Comment text
COMMENT`

const COMMENT_SPAM_SYSTEM = `You are a spam detection specialist.

## Task
Detect whether a comment is inappropriate content.

## Detection Targets
- spam: Spam, advertisement
- sensitive: Politically sensitive, pornographic, violent content
- low_quality: Meaningless, low-quality content

## Input Format
<<<COMMENT
Comment text
COMMENT`

const TRANSLATION_SYSTEM = `You are a professional translator.

## Absolute Requirement
EVERY word and sentence MUST be translated into the target language specified in the user message.
FORBIDDEN: Leaving ANY text in the source language. Mixed-language output is a critical failure.

## Formatting Rules
- Preserve Markdown formatting (headings, lists, bold, italic, links)
- Keep code blocks unchanged
- Keep URLs unchanged, translate link text only
- Keep widely recognized terms as-is: AI, API, WebGL, SaaS, GitHub, etc.
- Do NOT HTML-escape angle brackets in the output

## Structure Preservation Rules (CRITICAL)
- Do NOT modify ANY embedded React/JSX tags or HTML tags (including tag names, attributes/props, quoting style, whitespace, indentation, self-closing style, nesting, and order)
- Translate ONLY the human-readable text content (text nodes) around/between tags; keep the tag structure exactly the same as input
- Do NOT translate or rewrite anything inside JSX expressions like \`{...}\`, nor inside HTML/JSX attribute values unless the attribute is clearly plain visible text and translating it will not change its syntax (when in doubt: keep attribute values unchanged)
- Do NOT modify the structure of any Markdown extension syntax / directives (including but not limited to MDX components, callouts/admonitions, footnotes, tables, task lists, math blocks, frontmatter, and fenced blocks). Keep all markers and delimiters exactly unchanged; only translate the human-readable text within them

## Japanese Specialization (apply only when target language is Japanese)
<goal>Improve readability by adding furigana for hard-to-read loanwords and proper nouns.</goal>
<ruby_format>Use HTML ruby tags: <ruby>表記<rt>annotation</rt></ruby></ruby_format>
<rules>
  <rule>Apply ruby ONLY in TEXT_MARKDOWN section, NOT in TITLE, SUMMARY, or TAGS</rule>
  <rule>For Katakana loanwords: keep Katakana visible, put source word in <rt></rule>
  <rule>For difficult Kanji: put reading in Hiragana in <rt></rule>
  <rule>Do NOT add ruby in code blocks, inline code, URLs, or filenames</rule>
  <rule>Do NOT overuse - apply only to unfamiliar/ambiguous terms</rule>
</rules>

## Input Format
TARGET_LANGUAGE: Language name (the language to translate into)

<<<TITLE
Title text
TITLE

<<<TEXT_MARKDOWN
Main content in Markdown
TEXT_MARKDOWN

<<<SUMMARY (optional)
Summary text
SUMMARY

<<<TAGS (optional)
Comma-separated tags
TAGS

## Output
Return translated content in the target language only. No source language text allowed.`

// Default: disable reasoning for all AI tasks (cost & latency optimization)
const NO_REASONING: ReasoningEffort = 'none'

export const AI_PROMPTS = {
  // AI Summary Prompts
  summary: (lang: string, text: string) => {
    const targetLanguage =
      LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]
    return {
      systemPrompt: SUMMARY_SYSTEM,
      prompt: `TARGET_LANGUAGE: ${targetLanguage}

<<<CONTENT
${text}
CONTENT`,
      schema: z.object({
        summary: z
          .string()
          .describe(
            `The summary of the input text in ${targetLanguage}, max ${AI_SUMMARY_MAX_WORDS} words.`,
          ),
      }),
      reasoningEffort: NO_REASONING,
    }
  },

  // AI Writer Prompts
  writer: {
    titleAndSlug: (text: string) => ({
      systemPrompt: TITLE_AND_SLUG_SYSTEM,
      prompt: `<<<CONTENT
${text}
CONTENT`,
      schema: z.object({
        title: z
          .string()
          .describe(
            'A concise, engaging title in the same language as the input text that captures the main topic.',
          ),
        slug: z
          .string()
          .describe(
            'SEO-friendly slug in English. Lowercase, hyphens to separate words, alphanumeric only.',
          ),
        lang: z
          .string()
          .describe(
            'ISO 639-1 language code of the input text (e.g., "en", "zh", "ja").',
          ),
        keywords: z
          .array(z.string())
          .describe(
            '3-5 relevant keywords or key phrases representing the main topics.',
          ),
      }),
      reasoningEffort: NO_REASONING,
    }),

    slug: (title: string) => ({
      systemPrompt: SLUG_SYSTEM,
      prompt: `<<<TITLE
${title}
TITLE`,
      schema: z.object({
        slug: z
          .string()
          .describe(
            'SEO-friendly slug in English. Lowercase, hyphens to separate words, alphanumeric only, concise with relevant keywords.',
          ),
      }),
      reasoningEffort: NO_REASONING,
    }),
  },

  // Comment Review Prompts
  comment: {
    score: (text: string) => ({
      systemPrompt: COMMENT_SCORE_SYSTEM,
      prompt: `<<<COMMENT
${text}
COMMENT`,
      schema: z.object({
        score: z
          .number()
          .describe('Risk score 1-10, higher means more dangerous'),
        hasSensitiveContent: z
          .boolean()
          .describe(
            'Whether it contains politically sensitive, pornographic, violent, or threatening content',
          ),
      }),
      reasoningEffort: NO_REASONING,
    }),

    spam: (text: string) => ({
      systemPrompt: COMMENT_SPAM_SYSTEM,
      prompt: `<<<COMMENT
${text}
COMMENT`,
      schema: z.object({
        isSpam: z.boolean().describe('Whether it is spam content'),
        hasSensitiveContent: z
          .boolean()
          .describe(
            'Whether it contains politically sensitive, pornographic, violent, or threatening content',
          ),
      }),
      reasoningEffort: NO_REASONING,
    }),
  },

  // Translation Prompts
  translation: (
    targetLang: string,
    content: {
      title: string
      text: string
      summary?: string
      tags?: string[]
    },
  ) => {
    const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
    let prompt = `TARGET_LANGUAGE: ${targetLanguage}

<<<TITLE
${content.title}
TITLE

<<<TEXT_MARKDOWN
${content.text}
TEXT_MARKDOWN`

    if (content.summary) {
      prompt += `

<<<SUMMARY
${content.summary}
SUMMARY`
    }
    if (content.tags?.length) {
      prompt += `

<<<TAGS
${content.tags.join(', ')}
TAGS`
    }

    return {
      systemPrompt: TRANSLATION_SYSTEM,
      prompt,
      schema: z.object({
        sourceLang: z
          .string()
          .describe(
            'ISO 639-1 code of the detected source language (e.g., "en", "zh", "ja")',
          ),
        title: z
          .string()
          .describe(
            'The title fully translated into the target language, no mixed languages',
          ),
        text: z
          .string()
          .describe(
            'The text content fully translated into the target language, preserving Markdown formatting, no mixed languages allowed',
          ),
        summary: z
          .string()
          .nullable()
          .describe(
            'The summary fully translated into the target language (if provided)',
          ),
        tags: z
          .array(z.string())
          .nullable()
          .describe(
            'Array of tags translated into the target language (if provided)',
          ),
      }),
      reasoningEffort: NO_REASONING,
    }
  },
}
