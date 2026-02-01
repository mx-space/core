export enum ErrorCodeEnum {
  // app
  Default = 1,
  NoContentCanBeModified = 1000,
  ContentNotFound = 1001,
  ContentNotFoundCantProcess = 1002,

  // biz - general
  SlugNotAvailable = 10000,
  MaxCountLimit = 10001,

  // biz - validation (400)
  InvalidParameter = 10100,
  InvalidBody = 10101,
  InvalidSlug = 10102,
  InvalidName = 10103,
  InvalidReference = 10104,
  InvalidOrderValue = 10105,
  InvalidSearchType = 10106,
  InvalidRoomName = 10107,
  InvalidSubscribeType = 10108,

  // biz - resource not found (404)
  ResourceNotFound = 11000,
  CategoryNotFound = 11001,
  PostNotFound = 11002,
  SnippetNotFound = 11003,
  DraftNotFound = 11004,
  DraftHistoryNotFound = 11005,
  LinkNotFound = 11006,
  FileNotFound = 11007,
  WebhookNotFound = 11008,
  WebhookEventNotFound = 11009,
  TokenNotFound = 11010,
  ConfigNotFound = 11011,
  DocumentNotFound = 11012,
  EntryNotFound = 11013,
  RefModelNotFound = 11014,
  CronNotFound = 11015,
  PresetNotFound = 11016,
  FunctionNotFound = 11017,

  // biz - conflict/duplicate (400)
  DuplicateLink = 12000,
  SnippetExists = 12001,
  PresetKeyExists = 12002,
  AlreadySupported = 12003,
  UserAlreadyExists = 12004,
  FileExists = 12005,

  // biz - disabled/not enabled (400/403)
  LinkDisabled = 13000,
  SubpathLinkDisabled = 13001,
  AlgoliaNotEnabled = 13002,
  AlgoliaNotConfigured = 13003,
  BackupNotEnabled = 13004,
  SubscribeNotEnabled = 13005,
  PasswordLoginDisabled = 13006,
  AIProviderNotEnabled = 13007,

  // biz - forbidden (403)
  NoteForbidden = 14000,
  LinkApplyDisabled = 14001,
  SnippetPrivate = 14002,
  InitForbidden = 14003,
  PostHiddenOrEncrypted = 14004,
  CommentForbidden = 14005,
  ServerlessNoPermission = 14006,
  BuiltinPresetCannotDelete = 14007,

  // biz - auth (401/403)
  AuthChallengeMissing = 15000,
  AuthChallengeExpired = 15001,
  AuthRegistrationMissing = 15002,
  AuthUsernameIncorrect = 15003,
  AuthPasswordIncorrect = 15004,
  AuthSessionNotFound = 15005,
  AuthUserIdNotFound = 15006,
  AuthFailed = 15007,

  // biz - operation failed (400)
  CategoryHasPosts = 16000,
  PostRelatedNotExists = 16001,
  PostSelfRelation = 16002,
  CommentPostNotExists = 16003,
  FileRenameFailed = 16004,
  PasswordSameAsOld = 16005,
  InvalidCronMethod = 16006,
  SubscribeTypeEmpty = 16007,

  // biz - user (400)
  UserNotExists = 17000,
  InitAlreadyCompleted = 17001,

  // biz - snippet validation (400)
  SnippetInvalidJson = 18000,
  SnippetInvalidJson5 = 18001,
  SnippetInvalidYaml = 18002,
  SnippetInvalidFunction = 18003,

  // biz - link validation (400)
  LinkAvatarValidationFailed = 19000,

  // biz - config validation (422)
  ConfigValidationFailed = 19100,
  CannotGetIp = 19101,

  // comment
  CommentDisabled = 30000,
  CommentTooDeep = 30001,

  // serverless
  ServerlessError = 80000,

  // email
  EmailTemplateNotFound = 90000,

  // 422
  MineZip = 100001,

  // AI
  AINotEnabled = 200000,
  AIKeyExpired = 200001,
  AIException = 200002,
  AIProcessing = 200003,
  AIResultParsingError = 200004,
  AITranslationNotFound = 200005,
  AITaskNotFound = 200006,
  AITaskAlreadyCompleted = 200007,
  AITaskCannotRetry = 200008,

  // system
  MasterLost = 99998,
  BanInDemo = 999999,

  // Bing
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

    // validation (400)
    [ErrorCodeEnum.InvalidParameter]: ['参数无效', 400],
    [ErrorCodeEnum.InvalidBody]: ['请求体必须是对象', 422],
    [ErrorCodeEnum.InvalidSlug]: ['slug 必须是字符串', 422],
    [ErrorCodeEnum.InvalidName]: ['name 必须是字符串', 422],
    [ErrorCodeEnum.InvalidReference]: ['reference 必须是字符串', 422],
    [ErrorCodeEnum.InvalidOrderValue]: ['order 值必须唯一', 422],
    [ErrorCodeEnum.InvalidSearchType]: ['无效的搜索类型', 400],
    [ErrorCodeEnum.InvalidRoomName]: ['无效的房间名', 400],
    [ErrorCodeEnum.InvalidSubscribeType]: ['订阅类型无效', 400],

    // resource not found (404)
    [ErrorCodeEnum.ResourceNotFound]: ['资源不存在', 404],
    [ErrorCodeEnum.CategoryNotFound]: ['分类不存在', 404],
    [ErrorCodeEnum.PostNotFound]: ['文章不存在', 404],
    [ErrorCodeEnum.SnippetNotFound]: ['Snippet 不存在', 404],
    [ErrorCodeEnum.DraftNotFound]: ['草稿不存在', 404],
    [ErrorCodeEnum.DraftHistoryNotFound]: ['历史版本不存在', 404],
    [ErrorCodeEnum.LinkNotFound]: ['友链不存在', 404],
    [ErrorCodeEnum.FileNotFound]: ['文件不存在', 404],
    [ErrorCodeEnum.WebhookNotFound]: ['Webhook 不存在', 404],
    [ErrorCodeEnum.WebhookEventNotFound]: ['Webhook 事件不存在', 404],
    [ErrorCodeEnum.TokenNotFound]: ['Token 不存在', 404],
    [ErrorCodeEnum.ConfigNotFound]: ['设置不存在', 404],
    [ErrorCodeEnum.DocumentNotFound]: ['文档不存在', 404],
    [ErrorCodeEnum.EntryNotFound]: ['条目不存在', 404],
    [ErrorCodeEnum.RefModelNotFound]: ['引用模型不存在', 404],
    [ErrorCodeEnum.CronNotFound]: ['定时任务不存在', 404],
    [ErrorCodeEnum.PresetNotFound]: ['预设字段不存在', 404],
    [ErrorCodeEnum.FunctionNotFound]: ['函数不存在', 404],

    // conflict/duplicate (400)
    [ErrorCodeEnum.DuplicateLink]: ['请不要重复申请友链哦', 400],
    [ErrorCodeEnum.SnippetExists]: ['Snippet 已存在', 400],
    [ErrorCodeEnum.PresetKeyExists]: ['预设字段 key 已存在', 400],
    [ErrorCodeEnum.AlreadySupported]: ['你已经支持过啦！', 400],
    [ErrorCodeEnum.UserAlreadyExists]: ['我已经有一个主人了哦', 400],
    [ErrorCodeEnum.FileExists]: ['文件已存在', 400],

    // disabled/not enabled (400/403)
    [ErrorCodeEnum.LinkDisabled]: ['您的友链已被禁用，请联系管理员', 400],
    [ErrorCodeEnum.SubpathLinkDisabled]: [
      '管理员当前禁用了子路径友链申请',
      422,
    ],
    [ErrorCodeEnum.AlgoliaNotEnabled]: ['Algolia 未开启', 400],
    [ErrorCodeEnum.AlgoliaNotConfigured]: ['Algolia 未配置', 400],
    [ErrorCodeEnum.BackupNotEnabled]: ['请先在设置中开启备份功能', 400],
    [ErrorCodeEnum.SubscribeNotEnabled]: ['订阅功能未开启', 400],
    [ErrorCodeEnum.PasswordLoginDisabled]: ['密码登录已禁用', 400],
    [ErrorCodeEnum.AIProviderNotEnabled]: [
      '没有配置启用的 AI Provider，无法启用 AI 评论审核',
      400,
    ],

    // forbidden (403)
    [ErrorCodeEnum.NoteForbidden]: ['不要偷看人家的小心思啦~', 403],
    [ErrorCodeEnum.LinkApplyDisabled]: ['主人目前不允许申请友链了！', 403],
    [ErrorCodeEnum.SnippetPrivate]: ['Snippet 是私有的', 403],
    [ErrorCodeEnum.InitForbidden]: ['默认设置在完成注册之后不可见', 403],
    [ErrorCodeEnum.PostHiddenOrEncrypted]: ['该文章已隐藏或加密', 403],
    [ErrorCodeEnum.CommentForbidden]: ['主人禁止了评论', 403],
    [ErrorCodeEnum.ServerlessNoPermission]: ['没有权限运行该函数', 403],
    [ErrorCodeEnum.BuiltinPresetCannotDelete]: ['内置预设字段不能删除', 403],

    // auth (401/403)
    [ErrorCodeEnum.AuthChallengeMissing]: ['Challenge 不存在', 400],
    [ErrorCodeEnum.AuthChallengeExpired]: ['Challenge 已过期', 400],
    [ErrorCodeEnum.AuthRegistrationMissing]: ['注册信息不存在', 400],
    [ErrorCodeEnum.AuthUsernameIncorrect]: ['用户名不正确', 403],
    [ErrorCodeEnum.AuthPasswordIncorrect]: ['密码不正确', 403],
    [ErrorCodeEnum.AuthSessionNotFound]: ['会话不存在', 400],
    [ErrorCodeEnum.AuthUserIdNotFound]: ['用户 ID 不存在', 400],
    [ErrorCodeEnum.AuthFailed]: ['认证失败', 400],

    // operation failed (400)
    [ErrorCodeEnum.CategoryHasPosts]: ['该分类中有其他文章，无法被删除', 400],
    [ErrorCodeEnum.PostRelatedNotExists]: ['关联文章不存在', 400],
    [ErrorCodeEnum.PostSelfRelation]: ['文章不能关联自己', 400],
    [ErrorCodeEnum.CommentPostNotExists]: ['评论文章不存在', 400],
    [ErrorCodeEnum.FileRenameFailed]: ['重命名文件失败', 400],
    [ErrorCodeEnum.PasswordSameAsOld]: ['密码可不能和原来的一样哦', 422],
    [ErrorCodeEnum.InvalidCronMethod]: ['无效的定时任务方法', 400],
    [ErrorCodeEnum.SubscribeTypeEmpty]: ['订阅类型不能为空', 400],

    // user (400)
    [ErrorCodeEnum.UserNotExists]: ['我还没有主人', 400],
    [ErrorCodeEnum.InitAlreadyCompleted]: [
      '已经完成初始化，请登录后进行设置',
      400,
    ],

    // snippet validation (400)
    [ErrorCodeEnum.SnippetInvalidJson]: ['内容不是有效的 JSON', 400],
    [ErrorCodeEnum.SnippetInvalidJson5]: ['内容不是有效的 JSON5', 400],
    [ErrorCodeEnum.SnippetInvalidYaml]: ['内容不是有效的 YAML', 400],
    [ErrorCodeEnum.SnippetInvalidFunction]: ['Serverless 函数无效', 400],

    // link validation (400)
    [ErrorCodeEnum.LinkAvatarValidationFailed]: ['头像验证失败', 400],

    // config validation (422)
    [ErrorCodeEnum.ConfigValidationFailed]: ['配置验证失败', 422],
    [ErrorCodeEnum.CannotGetIp]: ['无法获取 IP', 422],

    [ErrorCodeEnum.MineZip]: ['文件格式必须是 zip 类型', 422],

    [ErrorCodeEnum.AINotEnabled]: ['AI 功能未开启', 400],
    [ErrorCodeEnum.AIKeyExpired]: ['AI Key 已过期，请联系管理员', 400],
    [ErrorCodeEnum.AIException]: ['AI 服务异常', 500],
    [ErrorCodeEnum.AIProcessing]: ['AI 正在处理此请求，请稍后再试', 400],
    [ErrorCodeEnum.AIResultParsingError]: ['AI 结果解析错误', 500],

    [ErrorCodeEnum.AITranslationNotFound]: ['翻译不存在', 404],
    [ErrorCodeEnum.AITaskNotFound]: ['AI 任务不存在', 404],
    [ErrorCodeEnum.AITaskAlreadyCompleted]: ['AI 任务已完成，无法取消', 400],
    [ErrorCodeEnum.AITaskCannotRetry]: ['AI 任务无法重试', 400],

    [ErrorCodeEnum.EmailTemplateNotFound]: ['邮件模板不存在', 400],

    [ErrorCodeEnum.BingAPIFailed]: ['Bing API 请求失败', 503],
    [ErrorCodeEnum.BingKeyInvalid]: ['Bing API 密钥无效', 401],
    [ErrorCodeEnum.BingDomainInvalid]: ['Bing API 域名无效', 400],
  },
)
