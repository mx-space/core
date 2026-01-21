import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration.js'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import 'dayjs/locale/zh-cn.js'

dayjs.locale('zh-cn')
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(duration)
