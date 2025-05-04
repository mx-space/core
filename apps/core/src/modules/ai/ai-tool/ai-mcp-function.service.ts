import OpenAI from 'openai'
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources'

import { Injectable } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'

import { McpService } from '../../mcp/mcp.service'
import { AiService } from '../ai.service'

@Injectable()
export class AiMcpFunctionService {
  constructor(
    private readonly mcpService: McpService,
    private readonly configService: ConfigsService,
  ) {}

  // 定义函数工具
  private getMcpTools(): ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'getPostById',
          description: '根据ID获取博客文章',
          parameters: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: '帖子的ID',
              },
            },
            required: ['id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getPosts',
          description: '获取博客文章列表',
          parameters: {
            type: 'object',
            properties: {
              page: {
                type: 'number',
                description: '页码，默认为1',
              },
              size: {
                type: 'number',
                description: '每页数量，默认为10',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getNoteById',
          description: '根据ID获取笔记',
          parameters: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: '笔记的ID或nid',
              },
            },
            required: ['id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getNotes',
          description: '获取笔记列表',
          parameters: {
            type: 'object',
            properties: {
              page: {
                type: 'number',
                description: '页码，默认为1',
              },
              size: {
                type: 'number',
                description: '每页数量，默认为10',
              },
            },
          },
        },
      },
    ]
  }

  // 执行函数调用
  private async executeFunction(functionName: string, args: any) {
    switch (functionName) {
      case 'getPostById':
        return await this.mcpService.getPostById(args.id)
      case 'getPosts':
        return await this.mcpService.getPosts(args.page || 1, args.size || 10)
      case 'getNoteById':
        return await this.mcpService.getNoteById(args.id)
      case 'getNotes':
        return await this.mcpService.getNotes(args.page || 1, args.size || 10)
      default:
        throw new Error(`未知函数: ${functionName}`)
    }
  }

  // 使用OpenAI原生的函数调用功能
  async runWithFunctions(userPrompt: string) {
    try {
      // 获取OpenAI配置
      const {
        ai: { openAiKey, openAiEndpoint, openAiPreferredModel },
      } = await this.configService.waitForConfigReady()

      if (!openAiKey) {
        throw new Error('OpenAI Key未配置')
      }

      // 创建OpenAI客户端
      const openai = new OpenAI({
        apiKey: openAiKey,
        baseURL: openAiEndpoint || undefined,
      })

      // 对话历史
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            '你是一个可以访问博客系统的AI助手。使用提供的函数访问数据，准确回答用户问题。',
        },
        { role: 'user', content: userPrompt },
      ]

      // 获取函数工具
      const tools = this.getMcpTools()

      // 第一步：让模型选择要调用的函数
      const initialResponse = await openai.chat.completions.create({
        model: openAiPreferredModel,
        messages,
        tools,
        tool_choice: 'auto',
      })

      const initialResponseMessage = initialResponse.choices[0].message
      messages.push(initialResponseMessage)

      // 是否有工具调用
      if (initialResponseMessage.tool_calls) {
        // 处理所有工具调用
        for (const toolCall of initialResponseMessage.tool_calls) {
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments)

          // 执行函数并获取结果
          const functionResponse = await this.executeFunction(
            functionName,
            functionArgs,
          )

          // 将函数结果添加到消息历史
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(functionResponse),
          })
        }

        // 根据工具调用结果生成最终回答
        const finalResponse = await openai.chat.completions.create({
          model: openAiPreferredModel,
          messages,
        })

        return finalResponse.choices[0].message.content
      } else {
        // 没有工具调用，直接返回回答
        return initialResponseMessage.content
      }
    } catch (error) {
      console.error('函数调用失败:', error)
      return `发生错误: ${error.message}`
    }
  }
}
