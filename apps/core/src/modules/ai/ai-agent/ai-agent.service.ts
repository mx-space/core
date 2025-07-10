import { generateText, streamText, tool } from 'ai'

import { z } from '@mx-space/compiled/zod'
import { Injectable } from '@nestjs/common'

import { McpService } from '../../mcp/mcp.service'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'

@Injectable()
export class AIAgentService {
  constructor(
    private readonly aiService: AiService,
    private readonly mcpService: McpService,
  ) {}

  // 使用Vercel AI SDK的工具与MCP数据交互（流式响应）
  async chatWithTools(userPrompt: string) {
    // 获取OpenAI模型
    const model = await this.aiService.getOpenAiModel()

    // 定义工具（与runWithTools相同）
    const tools = {
      get_post_by_id: tool({
        description: '根据ID获取博客文章',
        parameters: z.object({
          id: z.string().describe('帖子的ID'),
        }),
        execute: async ({ id }) => {
          try {
            const post = await this.mcpService.getPostById(id)
            return post
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_posts: tool({
        description: '获取博客文章列表',
        parameters: z.object({
          page: z.number().optional().default(1).describe('页码，默认为1'),
          size: z
            .number()
            .optional()
            .default(10)
            .describe('每页数量，默认为10'),
        }),
        execute: async ({ page, size }) => {
          try {
            const posts = await this.mcpService.getPosts(page, size)
            return posts
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_note_by_id: tool({
        description: '根据ID获取笔记',
        parameters: z.object({
          id: z.string().describe('笔记的ID或nid'),
        }),
        execute: async ({ id }) => {
          try {
            const note = await this.mcpService.getNoteById(id)
            return note
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_notes: tool({
        description: '获取笔记列表',
        parameters: z.object({
          page: z.number().optional().default(1).describe('页码，默认为1'),
          size: z
            .number()
            .optional()
            .default(10)
            .describe('每页数量，默认为10'),
        }),
        execute: async ({ page, size }) => {
          try {
            const notes = await this.mcpService.getNotes(page, size)
            return notes
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_latest_post: tool({
        description: '获取最新的一篇博客文章',
        parameters: z.object({}),
        execute: async () => {
          try {
            const post = await this.mcpService.getLatestPost()
            return post
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_latest_notes: tool({
        description: '获取最新的一篇笔记',
        parameters: z.object({}),
        execute: async () => {
          try {
            const notes = await this.mcpService.getLatestNotes()
            return notes
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_category_by_id: tool({
        description: '根据ID获取分类',
        parameters: z.object({
          id: z.string().describe('分类的ID'),
        }),
        execute: async ({ id }) => {
          try {
            const category = await this.mcpService.getCategoryById(id)
            return category
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_all_categories: tool({
        description: '获取所有分类及其文章数量',
        parameters: z.object({}),
        execute: async () => {
          try {
            const categories = await this.mcpService.getAllCategories()
            return categories
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_posts_by_category: tool({
        description: '获取指定分类下的所有文章',
        parameters: z.object({
          categoryId: z.string().describe('分类的ID'),
        }),
        execute: async ({ categoryId }) => {
          try {
            const posts = await this.mcpService.getPostsByCategory(categoryId)
            return posts
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_tags_summary: tool({
        description: '获取所有标签及其文章数量统计',
        parameters: z.object({}),
        execute: async () => {
          try {
            const tags = await this.mcpService.getTagsSummary()
            return tags
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_posts_by_tag: tool({
        description: '获取指定标签下的所有文章',
        parameters: z.object({
          tag: z.string().describe('标签名称'),
        }),
        execute: async ({ tag }) => {
          try {
            const posts = await this.mcpService.getPostsByTag(tag)
            return posts
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_page_by_id: tool({
        description: '根据ID获取页面',
        parameters: z.object({
          id: z.string().describe('页面的ID'),
        }),
        execute: async ({ id }) => {
          try {
            const page = await this.mcpService.getPageById(id)
            return page
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_all_pages: tool({
        description: '获取所有页面',
        parameters: z.object({}),
        execute: async () => {
          try {
            const pages = await this.mcpService.getAllPages()
            return pages
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_all_says: tool({
        description: '获取所有说说/状态更新',
        parameters: z.object({}),
        execute: async () => {
          try {
            const says = await this.mcpService.getAllSays()
            return says
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_random_say: tool({
        description: '获取随机一条说说/状态更新',
        parameters: z.object({}),
        execute: async () => {
          try {
            const say = await this.mcpService.getRandomSay()
            return say
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_all_recently: tool({
        description: '获取所有动态/活动',
        parameters: z.object({}),
        execute: async () => {
          try {
            const recently = await this.mcpService.getAllRecently()
            return recently
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_recently_by_id: tool({
        description: '根据ID获取特定动态/活动',
        parameters: z.object({
          id: z.string().describe('动态的ID'),
        }),
        execute: async ({ id }) => {
          try {
            const recently = await this.mcpService.getRecentlyById(id)
            return recently
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_latest_recently: tool({
        description: '获取最新的一条动态/活动',
        parameters: z.object({}),
        execute: async () => {
          try {
            const recently = await this.mcpService.getLatestRecently()
            return recently
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_recently_offset: tool({
        description: '获取指定范围的动态/活动',
        parameters: z.object({
          size: z.number().optional().default(10).describe('数量，默认为10'),
          before: z.string().optional().describe('获取此ID之前的动态'),
          after: z.string().optional().describe('获取此ID之后的动态'),
        }),
        execute: async ({ size, before, after }) => {
          try {
            const recently = await this.mcpService.getRecentlyOffset({
              size,
              before,
              after,
            })
            return recently
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_comments: tool({
        description: '获取所有评论，可按状态筛选',
        parameters: z.object({
          page: z.number().optional().default(1).describe('页码，默认为1'),
          size: z
            .number()
            .optional()
            .default(10)
            .describe('每页数量，默认为10'),
          state: z
            .number()
            .optional()
            .default(0)
            .describe('评论状态筛选，0表示所有'),
        }),
        execute: async ({ page, size, state }) => {
          try {
            const comments = await this.mcpService.getComments({
              page,
              size,
              state,
            })
            return comments
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_content_comments: tool({
        description: '获取特定内容的评论',
        parameters: z.object({
          id: z.string().describe('内容的ID'),
          type: z
            .string()
            .optional()
            .describe('内容类型，如post, note, page等'),
        }),
        execute: async ({ id, type }) => {
          try {
            const comments = await this.mcpService.getContentComments(id, type)
            return comments
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
    }

    // 使用streamText进行流式响应
    const result = await streamText({
      model,
      tools,
      system: AI_PROMPTS.agent.systemPrompt,
      prompt: userPrompt,
      maxSteps: 5,
    })

    return result
  }

  // 保留原有的非流式方法以备后用
  async runWithTools(userPrompt: string) {
    // 获取OpenAI模型
    const model = await this.aiService.getOpenAiModel()

    // 定义工具
    const tools = {
      get_post_by_id: tool({
        description: '根据ID获取博客文章',
        parameters: z.object({
          id: z.string().describe('帖子的ID'),
        }),
        execute: async ({ id }) => {
          try {
            const post = await this.mcpService.getPostById(id)
            return post
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_posts: tool({
        description: '获取博客文章列表',
        parameters: z.object({
          page: z.number().optional().default(1).describe('页码，默认为1'),
          size: z
            .number()
            .optional()
            .default(10)
            .describe('每页数量，默认为10'),
        }),
        execute: async ({ page, size }) => {
          try {
            const posts = await this.mcpService.getPosts(page, size)
            return posts
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_note_by_id: tool({
        description: '根据ID获取笔记',
        parameters: z.object({
          id: z.string().describe('笔记的ID或nid'),
        }),
        execute: async ({ id }) => {
          try {
            const note = await this.mcpService.getNoteById(id)
            return note
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_notes: tool({
        description: '获取笔记列表',
        parameters: z.object({
          page: z.number().optional().default(1).describe('页码，默认为1'),
          size: z
            .number()
            .optional()
            .default(10)
            .describe('每页数量，默认为10'),
        }),
        execute: async ({ page, size }) => {
          try {
            const notes = await this.mcpService.getNotes(page, size)
            return notes
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_latest_post: tool({
        description: '获取最新的一篇博客文章',
        parameters: z.object({}),
        execute: async () => {
          try {
            const post = await this.mcpService.getLatestPost()
            return post
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_latest_notes: tool({
        description: '获取最新的一篇笔记',
        parameters: z.object({}),
        execute: async () => {
          try {
            const notes = await this.mcpService.getLatestNotes()
            return notes
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_category_by_id: tool({
        description: '根据ID获取分类',
        parameters: z.object({
          id: z.string().describe('分类的ID'),
        }),
        execute: async ({ id }) => {
          try {
            const category = await this.mcpService.getCategoryById(id)
            return category
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_all_categories: tool({
        description: '获取所有分类及其文章数量',
        parameters: z.object({}),
        execute: async () => {
          try {
            const categories = await this.mcpService.getAllCategories()
            return categories
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_posts_by_category: tool({
        description: '获取指定分类下的所有文章',
        parameters: z.object({
          categoryId: z.string().describe('分类的ID'),
        }),
        execute: async ({ categoryId }) => {
          try {
            const posts = await this.mcpService.getPostsByCategory(categoryId)
            return posts
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_tags_summary: tool({
        description: '获取所有标签及其文章数量统计',
        parameters: z.object({}),
        execute: async () => {
          try {
            const tags = await this.mcpService.getTagsSummary()
            return tags
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_posts_by_tag: tool({
        description: '获取指定标签下的所有文章',
        parameters: z.object({
          tag: z.string().describe('标签名称'),
        }),
        execute: async ({ tag }) => {
          try {
            const posts = await this.mcpService.getPostsByTag(tag)
            return posts
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_page_by_id: tool({
        description: '根据ID获取页面',
        parameters: z.object({
          id: z.string().describe('页面的ID'),
        }),
        execute: async ({ id }) => {
          try {
            const page = await this.mcpService.getPageById(id)
            return page
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_all_pages: tool({
        description: '获取所有页面',
        parameters: z.object({}),
        execute: async () => {
          try {
            const pages = await this.mcpService.getAllPages()
            return pages
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_all_says: tool({
        description: '获取所有说说/状态更新',
        parameters: z.object({}),
        execute: async () => {
          try {
            const says = await this.mcpService.getAllSays()
            return says
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_random_say: tool({
        description: '获取随机一条说说/状态更新',
        parameters: z.object({}),
        execute: async () => {
          try {
            const say = await this.mcpService.getRandomSay()
            return say
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_all_recently: tool({
        description: '获取所有动态/活动',
        parameters: z.object({}),
        execute: async () => {
          try {
            const recently = await this.mcpService.getAllRecently()
            return recently
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_recently_by_id: tool({
        description: '根据ID获取特定动态/活动',
        parameters: z.object({
          id: z.string().describe('动态的ID'),
        }),
        execute: async ({ id }) => {
          try {
            const recently = await this.mcpService.getRecentlyById(id)
            return recently
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_latest_recently: tool({
        description: '获取最新的一条动态/活动',
        parameters: z.object({}),
        execute: async () => {
          try {
            const recently = await this.mcpService.getLatestRecently()
            return recently
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_recently_offset: tool({
        description: '获取指定范围的动态/活动',
        parameters: z.object({
          size: z.number().optional().default(10).describe('数量，默认为10'),
          before: z.string().optional().describe('获取此ID之前的动态'),
          after: z.string().optional().describe('获取此ID之后的动态'),
        }),
        execute: async ({ size, before, after }) => {
          try {
            const recently = await this.mcpService.getRecentlyOffset({
              size,
              before,
              after,
            })
            return recently
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_comments: tool({
        description: '获取所有评论，可按状态筛选',
        parameters: z.object({
          page: z.number().optional().default(1).describe('页码，默认为1'),
          size: z
            .number()
            .optional()
            .default(10)
            .describe('每页数量，默认为10'),
          state: z
            .number()
            .optional()
            .default(0)
            .describe('评论状态筛选，0表示所有'),
        }),
        execute: async ({ page, size, state }) => {
          try {
            const comments = await this.mcpService.getComments({
              page,
              size,
              state,
            })
            return comments
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
      get_content_comments: tool({
        description: '获取特定内容的评论',
        parameters: z.object({
          id: z.string().describe('内容的ID'),
          type: z
            .string()
            .optional()
            .describe('内容类型，如post, note, page等'),
        }),
        execute: async ({ id, type }) => {
          try {
            const comments = await this.mcpService.getContentComments(id, type)
            return comments
          } catch (error) {
            return { error: error.message }
          }
        },
      }),
    }

    // 执行AI调用
    const result = await generateText({
      model,
      tools,
      system: AI_PROMPTS.agent.systemPrompt,
      prompt: userPrompt,
      maxSteps: 5,
    })

    return result.text
  }
}
