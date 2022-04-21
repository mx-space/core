import dayjs from 'dayjs'

import 'dayjs/locale/zh-cn'

import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.locale('zh-cn')
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
