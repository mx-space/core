import { Transform } from 'class-transformer'

export const TransformBoolean = () =>
  Transform(({ value }) => value === '1' || value === 'true')
