import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '~/common/decorator/current-user.decorator'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { AuthService } from '../auth/auth.service'
import { RolesGuard } from '../auth/roles.guard'
import { UserDocument, UserModel } from './user.model'
import { UserService } from './user.service'
import { IsMaster } from '~/common/decorator/role.decorator'
import { AuthGuard } from '@nestjs/passport'
import { getAvatar } from '~/utils/index.util'
import { LoginDto, UserDto, UserPatchDto } from './dto/user.dto'

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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录' })
  @UseGuards(AuthGuard('local'))
  async login(
    @Body() dto: LoginDto,
    @CurrentUser() user: UserDocument,
    @IpLocation() ipLocation: IpRecord,
  ) {
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
  checkLogged(@IsMaster() isMaster: boolean) {
    return { ok: Number(isMaster), isGuest: !isMaster }
  }

  @Patch()
  @ApiOperation({ summary: '修改主人的信息 ' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async patchMasterData(
    @Body() body: UserPatchDto,
    @CurrentUser() user: UserDocument,
  ) {
    return await this.userService.patchUserData(user, body)
  }
}
