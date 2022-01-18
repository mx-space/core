/**
 * 服务集群工具
 */

import cluster from 'cluster'
import { EventBusEvents } from '~/constants/event.constant'
/**
 * Worker 事件 Emit
 * @param event
 * @param data
 */
export const workerEmit = (event: EventBusEvents, data?: any) => {
  if (cluster.isWorker) {
    process.send({ event, data, workerId: cluster.worker.id })
  }
}
