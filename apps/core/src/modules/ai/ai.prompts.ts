import {
  AI_SUMMARY_MAX_WORDS,
  DEFAULT_SUMMARY_LANG,
  LANGUAGE_CODE_TO_NAME,
} from './ai.constants'

export const AI_PROMPTS = {
  // AI Summary Prompts
  summary: {
    getSummaryPrompt: (lang: string, text: string) => {
      const targetLanguage =
        LANGUAGE_CODE_TO_NAME[lang] ||
        LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]
      return `Task:
Extract a concise summary from the provided text.

Requirements:
- Language: ${targetLanguage}
- Max words: ${AI_SUMMARY_MAX_WORDS}

Input (raw):
<<<INPUT
${text}
INPUT`
    },

    getSummaryDescription: (lang: string) =>
      `The summary of the input text in ${LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]}, max ${AI_SUMMARY_MAX_WORDS} words.`,
  },

  // AI Writer Prompts
  writer: {
    titleAndSlug: {
      prompt: (text: string) => `Task:
Generate metadata for the provided text content.

Requirements:
- title: A concise, engaging title in the same language as the input text
- slug: SEO-friendly, lowercase, hyphens only, alphanumeric, in English
- lang: ISO 639-1 language code of the input text
- keywords: 3-5 relevant keywords representing main topics

Input (raw):
<<<INPUT
${text}
INPUT`,
      schema: {
        title:
          'A concise, engaging title in the same language as the input text that captures the main topic.',
        slug: 'SEO-friendly slug in English. Lowercase, hyphens to separate words, alphanumeric only.',
        lang: 'ISO 639-1 language code of the input text (e.g., "en", "zh", "ja").',
        keywords:
          '3-5 relevant keywords or key phrases representing the main topics.',
      },
    },
    slug: {
      prompt: (title: string) => `Task:
Generate an SEO-friendly slug from the provided title.

Requirements:
- format: lowercase, hyphens to separate words, alphanumeric only
- language: English (regardless of title language)
- style: concise, include relevant keywords

Input title (raw):
<<<TITLE
${title}
TITLE`,
      schema: {
        slug: 'SEO-friendly slug in English. Lowercase, hyphens to separate words, alphanumeric only, concise with relevant keywords.',
      },
    },
  },

  // Comment Review Prompts
  comment: {
    score: {
      prompt: (text: string) => `Task:
Analyze the risk level of the comment content.

Evaluation criteria:
- spam: Spam, scam, advertisement
- toxic: Toxic content, offensive language
- sensitive: Politically sensitive, pornographic, violent, or threatening content
- quality: Overall content quality

Input comment (raw):
<<<COMMENT
${text}
COMMENT`,
      schema: {
        score: 'Risk score 1-10, higher means more dangerous',
        hasSensitiveContent:
          'Whether it contains politically sensitive, pornographic, violent, or threatening content',
      },
    },
    spam: {
      prompt: (text: string) => `Task:
Detect whether the comment is inappropriate content.

Detection targets:
- spam: Spam, advertisement
- sensitive: Politically sensitive, pornographic, violent content
- low_quality: Meaningless, low-quality content

Input comment (raw):
<<<COMMENT
${text}
COMMENT`,
      schema: {
        isSpam: 'Whether it is spam content',
        hasSensitiveContent:
          'Whether it contains politically sensitive, pornographic, violent, or threatening content',
      },
    },
  },

  // Translation Prompts
  translation: {
    getTranslationPrompt: (
      targetLang: string,
      content: {
        title: string
        text: string
        summary?: string
        tags?: string[]
      },
    ) => {
      const targetLanguage = LANGUAGE_CODE_TO_NAME[targetLang] || targetLang
      const japaneseSpecialization =
        targetLang === 'ja'
          ? `

<japanese_specialization>
  <goal>Improve readability for Japanese by adding furigana (pronunciation) for hard-to-read loanwords and proper nouns.</goal>
  <ruby_format>Use HTML ruby tags exactly as: &lt;ruby&gt;表記&lt;rt&gt;annotation&lt;/rt&gt;&lt;/ruby&gt;</ruby_format>
  <rules>
    <rule>Scope: Apply ruby annotation ONLY in the body text section (TEXT_MARKDOWN). Do NOT add ruby in TITLE, SUMMARY, or TAGS.</rule>
    <rule>When the Japanese translation contains complex loanwords (often in Katakana) or proper nouns that may be difficult to read, add furigana using &lt;ruby&gt; and &lt;rt&gt;.</rule>
    <rule>For Katakana loanwords, keep the Katakana as the visible term and put the source/original word (e.g., English) in &lt;rt&gt;.</rule>
    <rule>For Kanji proper nouns or hard-to-read Japanese terms, put the reading in &lt;rt&gt; in Hiragana.</rule>
    <rule>Do NOT add ruby inside code blocks, inline code, URLs, or filenames.</rule>
    <rule>Do NOT overuse ruby for very common words; apply it only to terms that are likely unfamiliar/ambiguous to readers.</rule>
  </rules>
  <example>
    <input>“生产环境”需要翻译成片假名，并对片假名注音</input>
    <output>&lt;ruby&gt;プロダクション&lt;rt&gt;Production&lt;/rt&gt;&lt;/ruby&gt;</output>
  </example>
</japanese_specialization>`
          : ''
      const summaryBlock = content.summary
        ? `

SUMMARY:
<<<SUMMARY
${content.summary}
SUMMARY`
        : ''
      const tagsBlock = content.tags?.length
        ? `

TAGS (comma-separated, raw):
<<<TAGS
${content.tags.join(', ')}
TAGS`
        : ''
      return `You are a professional translator. Translate the content below into ${targetLanguage}.

<absolute_requirement>
EVERY word and sentence MUST be translated into ${targetLanguage}.
FORBIDDEN: Leaving ANY text in the source language. Mixed-language output is a critical failure.
</absolute_requirement>

<formatting_rules>
  <rule>Preserve Markdown formatting (headings, lists, bold, italic, links)</rule>
  <rule>Keep code blocks unchanged</rule>
  <rule>Keep URLs unchanged, translate link text only</rule>
  <rule>Keep widely recognized terms as-is: AI, API, WebGL, SaaS, GitHub, etc.</rule>
  <rule>Do NOT HTML-escape angle brackets in the output (avoid &amp;lt; and &amp;gt;). Preserve JSX/HTML-like snippets in the body as-is.</rule>
</formatting_rules>
${japaneseSpecialization}

Source content (raw):

TITLE:
<<<TITLE
${content.title}
TITLE

TEXT_MARKDOWN:
<<<TEXT_MARKDOWN
${content.text}
TEXT_MARKDOWN
${summaryBlock}${tagsBlock}

Output the translation in ${targetLanguage} only. Do not include any source language text.`
    },

    schema: {
      sourceLang:
        'ISO 639-1 code of the detected source language (e.g., "en", "zh", "ja")',
      title:
        'The title fully translated into the target language, no mixed languages',
      text: 'The text content fully translated into the target language, preserving Markdown formatting, no mixed languages allowed',
      summary:
        'The summary fully translated into the target language (if provided)',
      tags: 'Array of tags translated into the target language (if provided)',
    },
  },
} as const
