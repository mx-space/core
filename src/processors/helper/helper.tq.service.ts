import { Injectable } from '@nestjs/common'
import { isAsyncFunction } from 'util/types'

type ITask = Map<
  string,
  {
    status: 'pending' | 'fulfill' | 'reject'
    updatedAt: Date
    message?: string
  }
>

@Injectable()
export class TaskQueueService {
  tasks: ITask
  constructor() {
    this.tasks = new Map()
  }

  add(name: string, task: () => Promise<any>) {
    this.tasks.set(name, { status: 'pending', updatedAt: new Date() })

    if (isAsyncFunction(task)) {
      task()
        .then(() => {
          this.tasks.set(name, { status: 'fulfill', updatedAt: new Date() })
        })
        .catch((err) => {
          console.debug(err)

          this.tasks.set(name, {
            status: 'reject',
            updatedAt: new Date(),
            message: err.message,
          })
        })
    } else {
      try {
        task()
        this.tasks.set(name, { status: 'fulfill', updatedAt: new Date() })
      } catch (err) {
        console.debug(err)

        this.tasks.set(name, {
          status: 'reject',
          updatedAt: new Date(),
          message: err.message,
        })
      }
    }
  }

  get(name: string) {
    const task = this.tasks.get(name)
    return !task ? null : { ...task }
  }

  get length() {
    return this.tasks.size
  }
}
