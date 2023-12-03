export enum ErrorCodeEnum {
  // app
  Default = 1,
  NoContentCanBeModified = 1000,

  // biz
  SlugNotAvailable = 10000,
  MaxCountLimit = 10001,
  CommentDisabled = 30000,
  CommentTooDeep = 30001,
  ServerlessError = 80000,
  EmailTemplateNotFound = 90000,

  // 422
  MineZip = 100001,

  // system
  MasterLost = 99998,
  BanInDemo = 999999,
}

export const ErrorCode = Object.freeze<Record<ErrorCodeEnum, [string, number]>>(
  {
    [ErrorCodeEnum.Default]: ['未知错误', 500],
    [ErrorCodeEnum.SlugNotAvailable]: ['slug 不可用', 400],
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

    [ErrorCodeEnum.EmailTemplateNotFound]: ['邮件模板不存在', 400],
  },
)
