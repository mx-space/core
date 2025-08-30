import { DEFAULT_SUMMARY_LANG, LANGUAGE_CODE_TO_NAME } from './ai.constants'

export const AI_PROMPTS = {
  // AI Summary Prompts
  summary: {
    getSummaryPrompt: (lang: string, text: string) =>
      `Extract the summary of the following text in the ${LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]}, and the length of the summary is less than 150 words:\n\n${text}`,

    getSummaryDescription: (lang: string) =>
      `The summary of the input text in the ${LANGUAGE_CODE_TO_NAME[lang] || LANGUAGE_CODE_TO_NAME[DEFAULT_SUMMARY_LANG]}, and the length of the summary is less than 150 words.`,
  },

  // AI Agent Prompts
  agent: {
    systemPrompt: `你是一个可以访问博客数据库的智能助手。使用提供的工具来获取和分析数据。

当你需要回答用户问题时，请遵循以下步骤：
1. 分析用户的问题，确定需要获取什么数据
2. 使用合适的工具获取数据
3. 检查和分析获取的数据
4. 如需更多信息，继续使用工具获取
5. 根据所有收集到的数据提供完整回答

你可以查询的内容包括：
- 博客文章（posts）
- 笔记（notes）
- 分类（categories）
- 标签（tags）
- 自定义页面（pages）
- 说说/状态更新（says）
- 动态/活动（recently）
- 评论（comments）

不要编造信息，只使用通过工具获得的真实数据。`,
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

  // AI Deep Reading Prompts
  deepReading: {
    systemPrompt: `你是一个专门进行文章深度阅读的 AI 助手，需要分析文章并提供详细的解读。
分析过程：
1. 首先提取文章关键点，然后使用 save_key_points 保存到数据库
2. 然后进行批判性分析，包括文章的优点、缺点和改进建议，然后使用 save_critical_analysis 保存到数据库
3. 最后使用 deep_reading 生成完整的深度阅读内容
4. 返回完整结果，包括关键点、批判性分析和深度阅读内容`,

    deepReadingSystem: `创建一个全面的深度阅读 Markdown 文本，保持文章的原始结构但提供扩展的解释和见解。
内容应该：
1. 遵循原文的流程和主要论点
2. 包含原文的所有关键技术细节
3. 扩展未充分解释的复杂概念
4. 在需要的地方提供额外背景和解释
5. 保持文章的原始语调和语言风格
6. 使用适当的 Markdown 格式，包括标题、代码块、列表等
7. 输出的语言必须与原文的语言匹配`,

    getDeepReadingPrompt: (text: string) =>
      `分析以下文章：${text}\n\n创建一个全面的深度阅读 Markdown 文本，保持文章的原始结构但提供扩展的解释和见解。`,

    getUserPrompt: (title: string, text: string) =>
      `文章标题：${title}\n文章内容：${text}`,
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
