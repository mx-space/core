import {
  AI_SUMMARY_MAX_WORDS,
  DEFAULT_SUMMARY_LANG,
  LANGUAGE_CODE_TO_NAME,
} from './ai.constants'

const escapeXml = (str: string): string =>
  str.replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export const AI_PROMPTS = {
  // AI Summary Prompts
  summary: {
    getSummaryPrompt: (lang: string, text: string) => {
      const targetLanguage =
        LANGUAGE_CODE_TO_NAME[lang] ||
        LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]
      return `<task>
Extract a concise summary from the provided text.
</task>

<requirements>
  <language>${targetLanguage}</language>
  <max_words>${AI_SUMMARY_MAX_WORDS}</max_words>
</requirements>

<input>
${escapeXml(text)}
</input>`
    },

    getSummaryDescription: (lang: string) =>
      `The summary of the input text in ${LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]}, max ${AI_SUMMARY_MAX_WORDS} words.`,
  },

  // AI Writer Prompts
  writer: {
    titleAndSlug: {
      prompt: (text: string) => `<task>
Generate metadata for the provided text content.
</task>

<requirements>
  <title>A concise, engaging title in the same language as the input text</title>
  <slug>SEO-friendly, lowercase, hyphens only, alphanumeric, in English</slug>
  <lang>ISO 639-1 language code of the input text</lang>
  <keywords>3-5 relevant keywords representing main topics</keywords>
</requirements>

<input>
${escapeXml(text)}
</input>`,
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
      prompt: (title: string) => `<task>
Generate an SEO-friendly slug from the provided title.
</task>

<requirements>
  <format>lowercase, hyphens to separate words, alphanumeric only</format>
  <language>English (regardless of title language)</language>
  <style>concise, include relevant keywords</style>
</requirements>

<input>
  <title>${escapeXml(title)}</title>
</input>`,
      schema: {
        slug: 'SEO-friendly slug in English. Lowercase, hyphens to separate words, alphanumeric only, concise with relevant keywords.',
      },
    },
  },

  // Comment Review Prompts
  comment: {
    score: {
      prompt: (text: string) => `<task>
Analyze the risk level of the comment content.
</task>

<evaluation_criteria>
  <spam>Spam, scam, advertisement</spam>
  <toxic>Toxic content, offensive language</toxic>
  <sensitive>Politically sensitive, pornographic, violent, or threatening content</sensitive>
  <quality>Overall content quality</quality>
</evaluation_criteria>

<input>
  <comment>${escapeXml(text)}</comment>
</input>`,
      schema: {
        score: 'Risk score 1-10, higher means more dangerous',
        hasSensitiveContent:
          'Whether it contains politically sensitive, pornographic, violent, or threatening content',
      },
    },
    spam: {
      prompt: (text: string) => `<task>
Detect whether the comment is inappropriate content.
</task>

<detection_targets>
  <spam>Spam, advertisement</spam>
  <sensitive>Politically sensitive, pornographic, violent content</sensitive>
  <low_quality>Meaningless, low-quality content</low_quality>
</detection_targets>

<input>
  <comment>${escapeXml(text)}</comment>
</input>`,
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
</formatting_rules>

<source_content>
  <title>${escapeXml(content.title)}</title>
  <text>
${escapeXml(content.text)}
  </text>${
    content.summary
      ? `
  <summary>${escapeXml(content.summary)}</summary>`
      : ''
  }${
    content.tags?.length
      ? `
  <tags>${content.tags.map(escapeXml).join(', ')}</tags>`
      : ''
  }
</source_content>

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
