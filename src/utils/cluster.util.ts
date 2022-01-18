import cluster from 'cluster'
import { EventBusEvents } from '~/constants/event.constant'
export const workerEmit = (event: EventBusEvents, data?: any) => {
  if (cluster.isWorker) {
    process.send({ event, data, workerId: cluster.worker.id })
  }
}
