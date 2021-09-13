import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import localizedFormat from 'dayjs/plugin/localizedFormat'
dayjs.locale('zh-cn')
dayjs.extend(localizedFormat)
