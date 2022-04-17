export enum ErrorCodeEnum {
  SlugNotAvailable = 'slug_not_available',
}

export const ErrorCode = Object.freeze<Record<ErrorCodeEnum, [string, number]>>(
  {
    [ErrorCodeEnum.SlugNotAvailable]: ['slug 不可用', 400],
  },
)
