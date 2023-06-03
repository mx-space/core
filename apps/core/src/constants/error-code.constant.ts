export enum ErrorCodeEnum {
  NoContentCanBeModified = 1000,

  SlugNotAvailable = 10000,
  MaxCountLimit = 10001,
  CommentDisabled = 30000,
  CommentTooDeep = 30001,
  ServerlessError = 80000,

  MasterLost = 99998,
  BanInDemo = 999999,
}

export const ErrorCode = Object.freeze<Record<ErrorCodeEnum, [string, number]>>(
  {
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
  },
)
