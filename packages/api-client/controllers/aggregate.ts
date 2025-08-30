import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { SortOrder } from '~/interfaces/options'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type {
  AggregateRootWithTheme,
  AggregateStat,
  AggregateTop,
  TimelineData,
  TimelineType,
} from '~/models/aggregate'
import { sortOrderToNumber } from '~/utils'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    aggregate: AggregateController<ResponseWrapper>
  }
}

export class AggregateController<ResponseWrapper> implements IController {
  base = 'aggregate'
  name = 'aggregate'
  constructor(private client: HTTPClient) {
    autoBind(this)
  }
  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  /**
   * 获取聚合数据
   */
  getAggregateData<Theme>(
    theme?: string,
  ): RequestProxyResult<AggregateRootWithTheme<Theme>, ResponseWrapper> {
    return this.proxy.get<AggregateRootWithTheme<Theme>>({
      params: {
        theme,
      },
    })
  }

  /**
   * 获取最新发布的内容
   */
  getTop(size = 5) {
    return this.proxy.top.get<AggregateTop>({ params: { size } })
  }

  getTimeline(options?: {
    sort?: SortOrder
    type?: TimelineType
    year?: number
  }) {
    const { sort, type, year } = options || {}
    return this.proxy.timeline.get<{ data: TimelineData }>({
      params: {
        sort: sort && sortOrderToNumber(sort),
        type,
        year,
      },
    })
  }
  /**
   * 获取聚合数据统计
   */
  getStat() {
    return this.proxy.stat.get<AggregateStat>()
  }
}
