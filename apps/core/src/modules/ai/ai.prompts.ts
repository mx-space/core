import {
  AI_SUMMARY_MAX_WORDS,
  DEFAULT_SUMMARY_LANG,
  LANGUAGE_CODE_TO_NAME,
} from './ai.constants'

export const AI_PROMPTS = {
  // AI Summary Prompts
  summary: {
    getSummaryPrompt: (lang: string, text: string) =>
      `Extract the summary of the following text in the ${LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]}, and the length of the summary is less than ${AI_SUMMARY_MAX_WORDS} words:\n\n${text}`,

    getSummaryDescription: (lang: string) =>
      `The summary of the input text in the ${LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]}, and the length of the summary is less than ${AI_SUMMARY_MAX_WORDS} words.`,
  },

  // AI Writer Prompts
  writer: {
    titleAndSlug: {
      prompt: (text: string) =>
        `Based on the following text content, generate a title, slug, language, and keywords.

Text content:
${text}

Please generate:
1. A concise, engaging title that captures the main topic
2. An SEO-friendly slug (lowercase, hyphens, alphanumeric only)
3. The language code of the text (e.g., "en" for English, "zh" for Chinese)
4. 3-5 relevant keywords that represent the main topics

Respond with a JSON object containing these fields.`,
      schema: {
        title:
          'Generate a concise, engaging title from the input text. The title should be in the same language as the input text and capture the main topic effectively.',
        slug: 'Create an SEO-friendly slug in English based on the title. The slug should be lowercase, use hyphens to separate words, contain only alphanumeric characters and hyphens, and include relevant keywords for better search engine ranking.',
        lang: 'Identify the natural language of the input text (e.g., "en", "zh", "es", "fr", etc.).',
        keywords:
          'Extract 3-5 relevant keywords or key phrases from the input text that represent its main topics.',
      },
    },
    slug: {
      prompt: (title: string) =>
        `Generate an SEO-friendly slug from the following title: "${title}"

The slug should:
- Be in lowercase
- Use hyphens to separate words
- Contain only alphanumeric characters and hyphens
- Be concise while including relevant keywords
- Be in English regardless of the title language

Respond with a JSON object containing the slug field.`,
      schema: {
        slug: 'An SEO-friendly slug in English based on the title. The slug should be lowercase, use hyphens to separate words, contain only alphanumeric characters and hyphens, and be concise while including relevant keywords from the title.',
      },
    },
  },

  // Comment Review Prompts
  comment: {
    score: {
      prompt: (text: string) =>
        `分析以下评论是否包含不适当内容：${text}\n\n评估其是否包含垃圾信息、诈骗、广告、有毒内容及整体质量。`,
      schema: {
        score: '风险评分，1-10，越高越危险',
        hasSensitiveContent: '是否包含政治敏感、色情、暴力或恐吓内容',
      },
    },
    spam: {
      prompt: (text: string) =>
        `检查以下评论是否不适当：${text}\n\n分析其是否包含垃圾信息、广告、政治敏感内容、色情、暴力或低质量内容。`,
      schema: {
        isSpam: '是否为垃圾内容',
        hasSensitiveContent: '是否包含政治敏感、色情、暴力或恐吓内容',
      },
    },
  },
} as const
