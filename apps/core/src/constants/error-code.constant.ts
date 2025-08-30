export enum ErrorCodeEnum {
  // app
  Default = 1,
  NoContentCanBeModified = 1000,
  ContentNotFound = 1001,
  ContentNotFoundCantProcess = 1002,

  // biz
  SlugNotAvailable = 10000,
  MaxCountLimit = 10001,
  CommentDisabled = 30000,
  CommentTooDeep = 30001,
  ServerlessError = 80000,
  EmailTemplateNotFound = 90000,

  // 422
  MineZip = 100001,
  // Ai
  AINotEnabled = 200000,
  AIKeyExpired = 200001,
  AIException = 200002,
  AIProcessing = 200003,
  AIResultParsingError = 200004,

  // system
  MasterLost = 99998,
  BanInDemo = 999999,

  //Bing
  BingAPIFailed = 300002,
  BingKeyInvalid = 300003,
  BingDomainInvalid = 300004,
}

export const ErrorCode = Object.freeze<Record<ErrorCodeEnum, [string, number]>>(
  {
    [ErrorCodeEnum.Default]: ['未知错误', 500],
    [ErrorCodeEnum.SlugNotAvailable]: ['slug 不可用', 400],
    [ErrorCodeEnum.ContentNotFound]: ['内容不存在', 404],
    [ErrorCodeEnum.ContentNotFoundCantProcess]: ['内容不存在，无法处理', 400],
    [ErrorCodeEnum.MaxCountLimit]: ['已达到最大数量限制', 400],
    [ErrorCodeEnum.BanInDemo]: ['Demo 模式下此操作不可用', 400],
    [ErrorCodeEnum.MasterLost]: ['站点主人信息已丢失', 500],
    [ErrorCodeEnum.CommentDisabled]: ['全站评论已关闭', 403],
    [ErrorCodeEnum.CommentTooDeep]: ['评论嵌套层数过深', 400],
    [ErrorCodeEnum.ServerlessError]: ['Function 执行报错', 500],
    [ErrorCodeEnum.NoContentCanBeModified]: [
      '内容不存在，没有内容可被修改',
      400,
    ],

    [ErrorCodeEnum.MineZip]: ['文件格式必须是 zip 类型', 422],

    [ErrorCodeEnum.AINotEnabled]: ['AI 功能未开启', 400],
    [ErrorCodeEnum.AIKeyExpired]: ['AI Key 已过期，请联系管理员', 400],
    [ErrorCodeEnum.AIException]: ['AI 服务异常', 500],
    [ErrorCodeEnum.AIProcessing]: ['AI 正在处理此请求，请稍后再试', 400],
    [ErrorCodeEnum.AIResultParsingError]: ['AI 结果解析错误', 500],

    [ErrorCodeEnum.EmailTemplateNotFound]: ['邮件模板不存在', 400],

    [ErrorCodeEnum.BingAPIFailed]: ['Bing API 请求失败', 503],
    [ErrorCodeEnum.BingKeyInvalid]: ['Bing API 密钥无效', 401],
    [ErrorCodeEnum.BingDomainInvalid]: ['Bing API 域名无效', 400],
  },
)
