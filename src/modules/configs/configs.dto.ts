import { Exclude, Transform, Type } from 'class-transformer'
import {
  ArrayUnique,
  IsBoolean,
  IsEmail,
  IsIP,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator'
import { JSONSchema } from 'class-validator-jsonschema'

import { ApiProperty } from '@nestjs/swagger'

import { IsAllowedUrl } from '~/utils/validator/isAllowedUrl'

import {
  JSONSchemaArrayField,
  JSONSchemaNumberField,
  JSONSchemaPasswordField,
  JSONSchemaPlainField,
  JSONSchemaToggleField,
} from './configs.jsonschema.decorator'

@JSONSchema({ title: 'SEO 优化' })
export class SeoDto {
  @IsString({ message: '标题必须是字符串' })
  @IsNotEmpty({ message: '不能为空!!' })
  @IsOptional()
  @JSONSchemaPlainField('网站标题')
  title: string

  @IsString({ message: '描述信息必须是字符串' })
  @IsNotEmpty({ message: '不能为空!!' })
  @IsOptional()
  @JSONSchemaPlainField('网站描述')
  description: string

  @IsString({ message: '关键字必须为一个数组', each: true })
  @IsOptional()
  @JSONSchemaArrayField('关键字')
  keywords?: string[]
}

@JSONSchema({ title: '网站设置' })
export class UrlDto {
  @IsAllowedUrl()
  @IsOptional()
  @ApiProperty({ example: 'http://127.0.0.1:2323' })
  @JSONSchemaPlainField('前端地址')
  webUrl: string

  @IsAllowedUrl()
  @IsOptional()
  @ApiProperty({ example: 'http://127.0.0.1:9528' })
  @JSONSchemaPlainField('管理后台地址')
  adminUrl: string

  @IsAllowedUrl()
  @IsOptional()
  @ApiProperty({ example: 'http://127.0.0.1:2333' })
  @JSONSchemaPlainField('API 地址')
  serverUrl: string

  @IsAllowedUrl()
  @IsOptional()
  @ApiProperty({ example: 'http://127.0.0.1:8080' })
  @JSONSchemaPlainField('Gateway 地址')
  wsUrl: string
}

class MailOption {
  @IsInt()
  @Transform(({ value: val }) => parseInt(val))
  @IsOptional()
  @JSONSchemaNumberField('发件邮箱端口')
  port: number
  @IsUrl({ require_protocol: false })
  @IsOptional()
  @JSONSchemaPlainField('发件邮箱 host')
  host: string
}
@JSONSchema({ title: '邮件通知设置' })
export class MailOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启邮箱提醒')
  enable: boolean
  @IsEmail()
  @IsOptional()
  @JSONSchemaPlainField('发件邮箱地址')
  user: string
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('发件邮箱密码')
  pass: string

  @ValidateNested()
  @Type(() => MailOption)
  @IsOptional()
  @JSONSchema({ 'ui:option': { connect: true } })
  options?: MailOption
}

@JSONSchema({ title: '评论设置' })
export class CommentOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('反垃圾评论')
  antiSpam: boolean

  @IsString({ each: true })
  @IsOptional()
  @ArrayUnique()
  @JSONSchemaArrayField('自定义屏蔽关键词')
  spamKeywords?: string[]

  @IsIP(undefined, { each: true })
  @ArrayUnique()
  @IsOptional()
  @JSONSchemaArrayField('自定义屏蔽 IP')
  blockIps?: string[]
  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('禁止非中文评论')
  disableNoChinese?: boolean
}

@JSONSchema({ title: '备份' })
export class BackupOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启自动备份', {
    description: '填写以下 COS 信息, 将同时上传备份到 COS',
  })
  enable: boolean

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('SecretId')
  secretId?: string

  @IsOptional()
  @IsString()
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('SecretKey')
  secretKey?: string

  @IsOptional()
  @IsString()
  @JSONSchemaPlainField('Bucket')
  bucket?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('地域 Region')
  region: string
}

@JSONSchema({ title: '百度推送设定' })
export class BaiduSearchOptionsDto {
  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('开启推送')
  enable: boolean

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('Token')
  token?: string
}

@JSONSchema({ title: 'Algolia Search' })
export class AlgoliaSearchOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaPlainField('开启 Algolia Search')
  enable: boolean

  @IsString()
  @IsOptional()
  @Exclude({ toPlainOnly: true })
  @JSONSchema({ format: 'password' })
  @JSONSchemaPasswordField('ApiKey')
  apiKey?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('AppId')
  appId?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('IndexName')
  indexName?: string
}

@JSONSchema({ title: '后台附加设置' })
export class AdminExtraDto {
  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('登录页面背景')
  background?: string
  @IsString()
  @IsOptional()
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('高德查询 API Key', { description: '日记地点定位' })
  gaodemapKey?: string

  @IsString()
  @IsOptional()
  @JSONSchemaPlainField('中后台标题')
  title?: string

  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('开启后台管理反代')
  /**
   * 是否开启后台反代访问
   */
  enableAdminProxy?: boolean
}

@JSONSchema({ title: '终端设定' })
export class TerminalOptionsDto {
  @IsOptional()
  @IsBoolean()
  @JSONSchemaToggleField('开启 WebShell')
  enable: boolean

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value == 'string' && value.length == 0 ? null : value,
  )
  @Exclude({ toPlainOnly: true })
  @JSONSchemaPasswordField('设定密码')
  password?: string

  @IsOptional()
  @IsString()
  @JSONSchemaPlainField('前置脚本')
  script?: string
}

@JSONSchema({ title: '友链设定' })
export class FriendLinkOptionsDto {
  @IsBoolean()
  @IsOptional()
  @JSONSchemaToggleField('允许申请友链')
  allowApply: boolean
}
