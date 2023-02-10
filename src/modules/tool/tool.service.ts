import { isIPv4, isIPv6 } from 'net'
import { URLSearchParams } from 'url'

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { HttpService } from '~/processors/helper/helper.http.service'

import { ConfigsService } from '../configs/configs.service'
import { IP } from './tool.interface'
import { IPResponseData } from './tool.response'

@Injectable()
export class ToolService {
  // private readonly logger: Logger
  constructor(
    private readonly httpService: HttpService,
    private readonly configs: ConfigsService,
  ) {
    // this.logger = new Logger(ToolService.name)
  }

  async getIp(ip: string, timeout = 3000): Promise<IP> {
    const isV4 = isIPv4(ip)
    const isV6 = isIPv6(ip)
    if (!isV4 && !isV6) {
      throw new UnprocessableEntityException('Invalid IP')
    }
    try {
      // const getIpQueryEndpoint = (ip, type: 'v4' | 'v6') =>
      //   `https://ip${type}.ip.mir6.com/api_json.php?ip=${ip}&token=mir6.com`

      if (isV4) {
        const data = await this.httpService.axiosRef.get<IPResponseData>(
          `https://ipv4.ip.mir6.com/api_json.php?ip=${ip}&token=mir6.com`,
          {
            timeout,
          },
        )

        const {
          data: { city, country, districts, isp, province, net },
        } = data.data
        return {
          cityName: districts,
          countryName: country + province,
          regionName: city,
          ip,
          ispDomain: isp,
          ownerDomain: isp || net,
        }
      } else {
        const { data } = (await this.httpService.axiosRef.get(
          `http://ip-api.com/json/${ip}`,
          {
            timeout,
          },
        )) as any

        const res = {
          cityName: data.city,
          countryName: data.country,
          ip: data.query,
          ispDomain: data.as,
          ownerDomain: data.org,
          regionName: data.region_name,
        } as const

        return res
      }
    } catch (e) {
      throw new BizException(`IP API 调用失败，${e.message}`)
    }
  }

  async getGeoLocationByGaode(longitude: string, latitude: string) {
    const {
      adminExtra: { gaodemapKey },
    } = await this.configs.waitForConfigReady()
    if (!gaodemapKey) {
      throw new BadRequestException('高德地图 API Key 未配置')
    }
    const data = await fetch(
      `https://restapi.amap.com/v3/geocode/regeo?key=${gaodemapKey}&location=` +
        `${longitude},${latitude}`,
    )
      .then((response) => response.json())
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      .catch((error) => {})
    if (!data) {
      throw new InternalServerErrorException('高德地图 API 调用失败')
    }
    return data
  }
  /**
   *
   * @param keywords keyword1|keyword2
   * @returns
   */
  async searchLocationByGaode(keywords: string) {
    const {
      adminExtra: { gaodemapKey },
    } = await this.configs.waitForConfigReady()
    if (!gaodemapKey) {
      throw new BadRequestException('高德地图 API Key 未配置')
    }

    const params = new URLSearchParams([
      ['key', gaodemapKey],
      ['keywords', keywords],
    ])

    let errorMessage = ''

    const data = await fetch(
      `https://restapi.amap.com/v3/place/text?${params.toString()}`,
    )
      .then((response) => response.json())
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      .catch((error) => {
        errorMessage = error.message
      })
    if (!data) {
      throw new InternalServerErrorException(
        `高德地图 API 调用失败，${errorMessage}`,
      )
    }
    return data
  }
}
