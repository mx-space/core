import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { compareSync } from 'bcrypt'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import { InjectModel } from 'nestjs-typegoose'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getAvatar } from '~/utils/index.util'
import { getRedisKey } from '~/utils/redis.util'
import { AuthService } from '../auth/auth.service'
import { UserDocument, UserModel } from './user.model'

@Injectable()
export class UserService {
  private Logger = new Logger(UserService.name)
  constructor(
    @InjectModel(UserModel)
    private readonly userModel: ReturnModelType<typeof UserModel>,
    private readonly authService: AuthService,
    private readonly redis: CacheService,
  ) {}

  async getMasterInfo(getLoginIp = false) {
    const user = await this.userModel
      .findOne()
      .select('-authCode' + (getLoginIp ? ' +lastLoginIp' : ''))
      .lean({ virtuals: true })
    if (!user) {
      throw new BadRequestException('没有完成初始化!')
    }
    const avatar = user.avatar ?? getAvatar(user.mail)
    return { ...user, avatar }
  }
  async hasMaster() {
    return !!(await this.userModel.countDocuments())
  }
  async createMaster(
    model: Pick<UserModel, 'username' | 'name' | 'password'> &
      Partial<Pick<UserModel, 'introduce' | 'avatar' | 'url'>>,
  ) {
    const hasMaster = await this.hasMaster()
    // 禁止注册两个以上账户
    if (hasMaster) {
      throw new BadRequestException('我已经有一个主人了哦')
    }
    const authCode = nanoid(10)

    // @ts-ignore
    const res = await this.userModel.create({ ...model, authCode })
    const token = await this.authService.signToken(res._id)
    return { token, username: res.username, authCode: res.authCode }
  }

  /**
   * 修改密码
   *
   * @async
   * @param {DocumentType} user - 用户查询结果, 已经挂载在 req.user
   * @param {Partial} data - 部分修改数据
   */
  async patchUserData(user: UserDocument, data: Partial<UserModel>) {
    const { password } = data
    const doc = { ...data }
    if (password !== undefined) {
      const { _id } = user
      const currentUser = await this.userModel
        .findById(_id)
        .select('+password +apiToken')
      // 1. 验证新旧密码是否一致
      const isSamePassword = compareSync(password, currentUser.password)
      if (isSamePassword) {
        throw new UnprocessableEntityException('密码可不能和原来的一样哦')
      }

      // 2. 认证码重新生成
      const newCode = nanoid(10)
      doc.authCode = newCode
    }
    return await this.userModel
      .updateOne({ _id: user._id }, doc)
      .setOptions({ omitUndefined: true })
  }

  /**
   * 记录登陆的足迹(ip, 时间)
   *
   * @async
   * @param {string} ip - string
   * @return {Promise<Record<string, Date|string>>} 返回上次足迹
   */
  async recordFootstep(ip: string): Promise<Record<string, Date | string>> {
    const master = await this.userModel.findOne()
    const PrevFootstep = {
      lastLoginTime: master.lastLoginTime || new Date(1586090559569),
      lastLoginIp: master.lastLoginIp || null,
    }
    await master.updateOne({
      lastLoginTime: new Date(),
      lastLoginIp: ip,
    })
    // save to redis
    process.nextTick(async () => {
      const redisClient = this.redis.getClient()
      const dateFormat = dayjs().format('YYYY-MM-DD')

      await redisClient.sadd(
        getRedisKey(RedisKeys.LoginRecord, dateFormat),
        JSON.stringify({ date: new Date().toISOString(), ip }),
      )
    })

    this.Logger.warn('主人已登录, IP: ' + ip)
    return PrevFootstep
  }

  // TODO 获取最近登陆次数 时间 从 Redis 取
}
