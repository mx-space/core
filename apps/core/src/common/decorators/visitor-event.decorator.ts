import {
  EventScope,
  type BusinessEvents,
} from '~/constants/business-event.constant'

const VISITOR_EVENT_KEY = Symbol('VISITOR_EVENT')

interface VisitorEventMeta {
  event: BusinessEvents
}

export const OnVisitorEvent = (event: BusinessEvents): MethodDecorator => {
  return (_target, _propertyKey, descriptor) => {
    Reflect.defineMetadata(
      VISITOR_EVENT_KEY,
      { event } satisfies VisitorEventMeta,
      descriptor.value!,
    )
    return descriptor
  }
}

export function collectVisitorEventHandlers(
  instance: object,
): Map<BusinessEvents, (data: any) => void> {
  const map = new Map<BusinessEvents, (data: any) => void>()
  const proto = Object.getPrototypeOf(instance)

  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor') continue
    const method = proto[key]
    if (typeof method !== 'function') continue

    const meta: VisitorEventMeta | undefined = Reflect.getMetadata(
      VISITOR_EVENT_KEY,
      method,
    )
    if (!meta) continue

    map.set(meta.event, method.bind(instance))
  }

  return map
}

export function hasVisitorScope(scope: EventScope): boolean {
  return (scope & EventScope.TO_VISITOR) !== 0
}
