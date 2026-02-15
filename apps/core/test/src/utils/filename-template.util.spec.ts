import {
  generateFilename,
  generateFilePath,
  replaceFilenameTemplate,
} from '~/utils/filename-template.util'
import { describe, expect, it } from 'vitest'

describe('Filename Template Util', () => {
  const mockContext = {
    originalFilename: 'test-photo.jpg',
    fileType: 'image',
    localFolderPath: 'photos/2026/vacation',
  }

  describe('replaceFilenameTemplate', () => {
    it('应该替换文件名占位符', () => {
      const result = replaceFilenameTemplate('{filename}', mockContext)
      expect(result).toBe('test-photo.jpg')
    })

    it('应该替换文件名（不含扩展名）和扩展名', () => {
      const result = replaceFilenameTemplate('{name}{ext}', mockContext)
      expect(result).toBe('test-photo.jpg')
    })

    it('应该替换文件类型', () => {
      const result = replaceFilenameTemplate('{type}/{filename}', mockContext)
      expect(result).toBe('image/test-photo.jpg')
    })

    it('应该替换年份占位符', () => {
      const template = '{Y}/{y}/{filename}'
      const result = replaceFilenameTemplate(template, mockContext)
      expect(result).toMatch(/^\d{4}\/\d{2}\/test-photo\.jpg$/)
    })

    it('应该替换日期时间占位符', () => {
      const template = '{Y}{m}{d}_{h}{i}{s}{ext}'
      const result = replaceFilenameTemplate(template, mockContext)
      expect(result).toMatch(/^\d{8}_\d{6}\.jpg$/)
    })

    it('应该生成MD5随机字符串', () => {
      const result = replaceFilenameTemplate('{md5}{ext}', mockContext)
      expect(result).toMatch(/^[a-f0-9]{32}\.jpg$/)
    })

    it('应该生成16位MD5随机字符串', () => {
      const result = replaceFilenameTemplate('{md5-16}{ext}', mockContext)
      expect(result).toMatch(/^[a-f0-9]{16}\.jpg$/)
    })

    it('应该生成UUID', () => {
      const result = replaceFilenameTemplate('{uuid}{ext}', mockContext)
      expect(result).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jpg$/,
      )
    })

    it('应该生成自定义长度的随机字符串', () => {
      const result = replaceFilenameTemplate('{str-8}{ext}', mockContext)
      expect(result).toMatch(/^.{8}\.jpg$/)
    })

    it('应该生成时间戳', () => {
      const result = replaceFilenameTemplate('{timestamp}{ext}', mockContext)
      expect(result).toMatch(/^\d+\.jpg$/)
    })

    it('应该提取文件夹层级', () => {
      const result1 = replaceFilenameTemplate(
        '{localFolder:1}/{filename}',
        mockContext,
      )
      expect(result1).toBe('vacation/test-photo.jpg')

      const result2 = replaceFilenameTemplate(
        '{localFolder:2}/{filename}',
        mockContext,
      )
      expect(result2).toBe('2026/vacation/test-photo.jpg')

      const result3 = replaceFilenameTemplate(
        '{localFolder:3}/{filename}',
        mockContext,
      )
      expect(result3).toBe('photos/2026/vacation/test-photo.jpg')
    })

    it('应该处理没有本地文件夹路径的情况', () => {
      const contextWithoutFolder = {
        ...mockContext,
        localFolderPath: undefined,
      }
      const result = replaceFilenameTemplate(
        '{localFolder:1}/{filename}',
        contextWithoutFolder,
      )
      expect(result).toBe('/test-photo.jpg')
    })

    it('应该正确处理复杂模板', () => {
      const template = '{type}/{Y}/{m}/{d}/{md5-16}{ext}'
      const result = replaceFilenameTemplate(template, mockContext)
      expect(result).toMatch(/^image\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9]{16}\.jpg$/)
    })
  })

  describe('generateFilename', () => {
    it('未启用自定义命名时应该生成默认文件名', () => {
      const config = {
        enableCustomNaming: false,
        filenameTemplate: '{Y}{m}{d}/{md5-16}{ext}',
      }
      const result = generateFilename(config, mockContext)
      // 默认文件名是18位随机字符 + 扩展名
      expect(result).toMatch(/^.{18}\.jpg$/)
    })

    it('启用自定义命名时应该使用模板', () => {
      const config = {
        enableCustomNaming: true,
        filenameTemplate: '{Y}{m}{d}/{md5-16}{ext}',
      }
      const result = generateFilename(config, mockContext)
      expect(result).toMatch(/^\d{8}\/[a-f0-9]{16}\.jpg$/)
    })

    it('没有模板时应该使用默认规则', () => {
      const config = {
        enableCustomNaming: true,
        filenameTemplate: undefined,
      }
      const result = generateFilename(config, mockContext)
      expect(result).toMatch(/^.{18}\.jpg$/)
    })
  })

  describe('generateFilePath', () => {
    it('未启用自定义命名时应该返回文件类型', () => {
      const config = {
        enableCustomNaming: false,
        pathTemplate: '{type}/{Y}/{m}',
      }
      const result = generateFilePath(config, mockContext)
      expect(result).toBe('image')
    })

    it('启用自定义命名时应该使用路径模板', () => {
      const config = {
        enableCustomNaming: true,
        pathTemplate: '{type}/{Y}/{m}',
      }
      const result = generateFilePath(config, mockContext)
      expect(result).toMatch(/^image\/\d{4}\/\d{2}$/)
    })

    it('没有路径模板时应该返回文件类型', () => {
      const config = {
        enableCustomNaming: true,
        pathTemplate: undefined,
      }
      const result = generateFilePath(config, mockContext)
      expect(result).toBe('image')
    })
  })
})
