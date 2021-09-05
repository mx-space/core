import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { HttpCache } from '~/common/decorator/cache.decorator'
import { CurrentUser } from '~/common/decorator/current-user.decorator'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { getAvatar } from '~/utils/index.util'
import { AuthService } from '../auth/auth.service'
import { RolesGuard } from '../auth/roles.guard'
import { LoginDto, UserDto, UserPatchDto } from './user.dto'
import { UserDocument, UserModel } from './user.model'
import { UserService } from './user.service'

@ApiTags('User Routes')
@Controller(['master', 'user'])
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取主人信息' })
  @UseGuards(RolesGuard)
  async getMasterInfo(@IsMaster() isMaster: boolean) {
    return await this.userService.getMasterInfo(isMaster)
  }

  @Post('register')
  @SerializeOptions({
    excludePrefixes: ['password'],
  })
  @ApiOperation({ summary: '注册' })
  async register(@Body() userDto: UserDto) {
    userDto.name = userDto.name ?? userDto.username
    return await this.userService.createMaster(userDto as UserModel)
  }

  @Post('login')
  @ApiOperation({ summary: '登录' })
  @HttpCache({ disable: true })
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @IpLocation() ipLocation: IpRecord) {
    const user = await this.userService.login(dto.username, dto.password)
    const footstep = await this.userService.recordFootstep(ipLocation.ip)
    const { name, username, created, url, mail } = user
    const avatar = user.avatar ?? getAvatar(mail)

    return {
      token: await this.authService.signToken(user._id),
      ...footstep,
      name,
      username,
      created,
      url,
      mail,
      avatar,
      expiresIn: 7,
    }
  }

  @Get('check_logged')
  @ApiOperation({ summary: '判断当前 Token 是否有效 ' })
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @HttpCache({ disable: true })
  checkLogged(@IsMaster() isMaster: boolean) {
    return { ok: +isMaster, isGuest: !isMaster }
  }

  @Patch()
  @ApiOperation({ summary: '修改主人的信息 ' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @HttpCache({ disable: true })
  async patchMasterData(
    @Body() body: UserPatchDto,
    @CurrentUser() user: UserDocument,
  ) {
    return await this.userService.patchUserData(user, body)
  }
}
