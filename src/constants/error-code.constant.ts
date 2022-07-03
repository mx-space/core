export enum ErrorCodeEnum {
  SlugNotAvailable = 'slug_not_available',

  BanInDemo = 'ban_in_demo',
  MasterLost = 'master_lost',
  ServerlessError = 'function_error',
}

export const ErrorCode = Object.freeze<Record<ErrorCodeEnum, [string, number]>>(
  {
    [ErrorCodeEnum.SlugNotAvailable]: ['slug 不可用', 400],
    [ErrorCodeEnum.BanInDemo]: ['Demo 模式下此操作不可用', 400],
    [ErrorCodeEnum.MasterLost]: ['站点主人信息已丢失', 500],
    [ErrorCodeEnum.ServerlessError]: ['Function 执行报错', 500],
  },
)
