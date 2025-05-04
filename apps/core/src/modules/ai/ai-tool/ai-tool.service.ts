import { StringOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { DynamicStructuredTool, ToolInterface } from '@langchain/core/tools'
import { ChatOpenAI } from '@langchain/openai'
import { z } from '@mx-space/compiled/zod'
import { Injectable } from '@nestjs/common'

import { McpService } from '../../mcp/mcp.service'
import { AiService } from '../ai.service'

@Injectable()
export class AiToolService {
  constructor(
    private readonly aiService: AiService,
    private readonly mcpService: McpService,
  ) {}

  // 创建获取帖子的工具
  private createGetPostTool(): ToolInterface {
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
  private createGetPostsTool(): ToolInterface {
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
  private createGetNoteTool(): ToolInterface {
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
  private createGetNotesTool(): ToolInterface {
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

  // 使用OpenAI工具调用功能与MCP数据交互
  async runWithTools(userPrompt: string) {
    // 获取OpenAI模型
    const baseModel = await this.aiService.getOpenAiChain()

    // 创建支持工具的模型
    const model = new ChatOpenAI({
      modelName: baseModel.model,
      apiKey: baseModel.apiKey,

      temperature: 0,
    })

    // 初始化工具列表
    const tools = [
      this.createGetPostTool(),
      this.createGetPostsTool(),
      this.createGetNoteTool(),
      this.createGetNotesTool(),
    ]

    // 创建带工具的模型
    const modelWithTools = model.bind({
      tools,
    })

    // 设置提示模板
    const prompt = ChatPromptTemplate.fromTemplate(`
      你是一个可以访问博客数据库的助手。使用提供的工具来回答用户的问题。
      
      用户问题: {userPrompt}
      
      思考步骤:
      1. 确定需要使用哪些工具来回答问题
      2. 使用工具获取必要的数据
      3. 基于获取的数据提供详细、准确的回答
      
      注意: 仅使用提供的工具获取数据，不要编造信息。
    `)

    // 构建处理链
    const chain = prompt.pipe(modelWithTools).pipe(new StringOutputParser())

    // 执行并返回结果
    const result = await chain.invoke({
      userPrompt,
    })

    return result
  }
}
