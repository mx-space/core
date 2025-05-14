import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents'

import { ToolDefinition } from '@langchain/core/language_models/base'
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from '@mx-space/compiled/zod'
import { Injectable } from '@nestjs/common'

import { McpService } from '../../mcp/mcp.service'
import { AiService } from '../ai.service'

@Injectable()
export class AIAgentService {
  constructor(
    private readonly aiService: AiService,
    private readonly mcpService: McpService,
  ) {}

  // 创建获取帖子的工具
  private createGetPostTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_post_by_id',
      description: '根据ID获取博客文章',
      schema: z.object({
        id: z.string().describe('帖子的ID'),
      }),
      func: async ({ id }) => {
        try {
          const post = await this.mcpService.getPostById(id)
          return JSON.stringify(post)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取帖子列表的工具
  private createGetPostsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_posts',
      description: '获取博客文章列表',
      schema: z.object({
        page: z.number().optional().describe('页码，默认为1'),
        size: z.number().optional().describe('每页数量，默认为10'),
      }),
      func: async ({ page = 1, size = 10 }) => {
        try {
          const posts = await this.mcpService.getPosts(page, size)
          return JSON.stringify(posts)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取笔记的工具
  private createGetNoteTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_note_by_id',
      description: '根据ID获取笔记',
      schema: z.object({
        id: z.string().describe('笔记的ID或nid'),
      }),
      func: async ({ id }) => {
        try {
          const note = await this.mcpService.getNoteById(id)
          return JSON.stringify(note)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取笔记列表的工具
  private createGetNotesTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_notes',
      description: '获取笔记列表',
      schema: z.object({
        page: z.number().optional().describe('页码，默认为1'),
        size: z.number().optional().describe('每页数量，默认为10'),
      }),
      func: async ({ page = 1, size = 10 }) => {
        try {
          const notes = await this.mcpService.getNotes(page, size)
          return JSON.stringify(notes)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  private createGetLatestPostTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_latest_post',
      description: '获取最新的一篇博客文章',
      func: async () => {
        const post = await this.mcpService.getLatestPost()
        return JSON.stringify(post)
      },
      schema: z.object({}),
    })
  }

  private createGetLatestNotesTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_latest_notes',
      description: '获取最新的一篇笔记',
      func: async () => {
        const notes = await this.mcpService.getLatestNotes()
        return JSON.stringify(notes)
      },
      schema: z.object({}),
    })
  }

  // 创建获取分类的工具
  private createGetCategoryTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_category_by_id',
      description: '根据ID获取分类',
      schema: z.object({
        id: z.string().describe('分类的ID'),
      }),
      func: async ({ id }) => {
        try {
          const category = await this.mcpService.getCategoryById(id)
          return JSON.stringify(category)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取所有分类的工具
  private createGetAllCategoriesTools(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_all_categories',
      description: '获取所有分类及其文章数量',
      schema: z.object({}),
      func: async () => {
        try {
          const categories = await this.mcpService.getAllCategories()
          return JSON.stringify(categories)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取分类下文章的工具
  private createGetPostsByCategoryTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_posts_by_category',
      description: '获取指定分类下的所有文章',
      schema: z.object({
        categoryId: z.string().describe('分类的ID'),
      }),
      func: async ({ categoryId }) => {
        try {
          const posts = await this.mcpService.getPostsByCategory(categoryId)
          return JSON.stringify(posts)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取标签统计的工具
  private createGetTagsSummaryTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_tags_summary',
      description: '获取所有标签及其文章数量统计',
      schema: z.object({}),
      func: async () => {
        try {
          const tags = await this.mcpService.getTagsSummary()
          return JSON.stringify(tags)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取标签下文章的工具
  private createGetPostsByTagTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_posts_by_tag',
      description: '获取指定标签下的所有文章',
      schema: z.object({
        tag: z.string().describe('标签名称'),
      }),
      func: async ({ tag }) => {
        try {
          const posts = await this.mcpService.getPostsByTag(tag)
          return JSON.stringify(posts)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取页面的工具
  private createGetPageTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_page_by_id',
      description: '根据ID获取页面',
      schema: z.object({
        id: z.string().describe('页面的ID'),
      }),
      func: async ({ id }) => {
        try {
          const page = await this.mcpService.getPageById(id)
          return JSON.stringify(page)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取所有页面的工具
  private createGetAllPagesTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_all_pages',
      description: '获取所有页面',
      schema: z.object({}),
      func: async () => {
        try {
          const pages = await this.mcpService.getAllPages()
          return JSON.stringify(pages)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取所有说说的工具
  private createGetAllSaysTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_all_says',
      description: '获取所有说说/状态更新',
      schema: z.object({}),
      func: async () => {
        try {
          const says = await this.mcpService.getAllSays()
          return JSON.stringify(says)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取随机说说的工具
  private createGetRandomSayTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_random_say',
      description: '获取随机一条说说/状态更新',
      schema: z.object({}),
      func: async () => {
        try {
          const say = await this.mcpService.getRandomSay()
          return JSON.stringify(say)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取所有动态的工具
  private createGetAllRecentlyTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_all_recently',
      description: '获取所有动态/活动',
      schema: z.object({}),
      func: async () => {
        try {
          const recently = await this.mcpService.getAllRecently()
          return JSON.stringify(recently)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取特定动态的工具
  private createGetRecentlyByIdTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_recently_by_id',
      description: '根据ID获取特定动态/活动',
      schema: z.object({
        id: z.string().describe('动态的ID'),
      }),
      func: async ({ id }) => {
        try {
          const recently = await this.mcpService.getRecentlyById(id)
          return JSON.stringify(recently)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取最新动态的工具
  private createGetLatestRecentlyTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_latest_recently',
      description: '获取最新的一条动态/活动',
      schema: z.object({}),
      func: async () => {
        try {
          const recently = await this.mcpService.getLatestRecently()
          return JSON.stringify(recently)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取分页动态的工具
  private createGetRecentlyOffsetTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_recently_offset',
      description: '获取指定范围的动态/活动',
      schema: z.object({
        size: z.number().optional().describe('数量，默认为10'),
        before: z.string().optional().describe('获取此ID之前的动态'),
        after: z.string().optional().describe('获取此ID之后的动态'),
      }),
      func: async ({ size = 10, before, after }) => {
        try {
          const recently = await this.mcpService.getRecentlyOffset({
            size,
            before,
            after,
          })
          return JSON.stringify(recently)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取评论列表的工具
  private createGetCommentsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_comments',
      description: '获取所有评论，可按状态筛选',
      schema: z.object({
        page: z.number().optional().describe('页码，默认为1'),
        size: z.number().optional().describe('每页数量，默认为10'),
        state: z.number().optional().describe('评论状态筛选，0表示所有'),
      }),
      func: async ({ page = 1, size = 10, state = 0 }) => {
        try {
          const comments = await this.mcpService.getComments({
            page,
            size,
            state,
          })
          return JSON.stringify(comments)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 创建获取内容评论的工具
  private createGetContentCommentsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'get_content_comments',
      description: '获取特定内容的评论',
      schema: z.object({
        id: z.string().describe('内容的ID'),
        type: z.string().optional().describe('内容类型，如post, note, page等'),
      }),
      func: async ({ id, type }) => {
        try {
          const comments = await this.mcpService.getContentComments(id, type)
          return JSON.stringify(comments)
        } catch (error) {
          return `Error: ${error.message}`
        }
      },
    })
  }

  // 使用LangChain的Agent模式与MCP数据交互
  async runWithTools(userPrompt: string) {
    // 获取OpenAI模型
    const model = await this.aiService.getOpenAiChain()

    // 初始化工具列表
    const tools = [
      this.createGetPostTool(),
      this.createGetPostsTool(),
      this.createGetNoteTool(),
      this.createGetNotesTool(),
      this.createGetLatestPostTool(),
      this.createGetLatestNotesTool(),
      this.createGetCategoryTool(),
      this.createGetAllCategoriesTools(),
      this.createGetPostsByCategoryTool(),
      this.createGetTagsSummaryTool(),
      this.createGetPostsByTagTool(),
      this.createGetPageTool(),
      this.createGetAllPagesTool(),
      this.createGetAllSaysTool(),
      this.createGetRandomSayTool(),
      this.createGetAllRecentlyTool(),
      this.createGetRecentlyByIdTool(),
      this.createGetLatestRecentlyTool(),
      this.createGetRecentlyOffsetTool(),
      this.createGetCommentsTool(),
      this.createGetContentCommentsTool(),
    ]

    // 创建Agent提示模板
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是一个可以访问博客数据库的智能助手。使用提供的工具来获取和分析数据。
        
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
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ])

    // 创建Agent
    const agent = await createOpenAIToolsAgent({
      llm: model,
      tools,
      prompt,
    })

    // 创建Agent执行器
    const executor = new AgentExecutor({
      agent,
      tools,
      maxIterations: 5,
      verbose: isDev,
    })

    // 执行Agent
    const result = await executor.invoke({
      input: userPrompt,
      chat_history: [],
    })

    return result.output
  }
}
