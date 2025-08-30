import { createE2EApp } from '@/helper/create-e2e-app'
import { authPassHeader } from '@/mock/guard/auth.guard'
import type { ReturnModelType } from '@typegoose/typegoose'
import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'
import { BaseCrudFactory } from '~/transformers/crud-factor.transformer'
import { IsDefined, IsNumber } from 'class-validator'
import { eventEmitterProvider } from 'test/mock/processors/event.mock'

@modelOptions({
  options: {
    customName: 'model-test',
  },
})
class TestModel extends BaseModel {
  @prop()
  @IsNumber()
  number: number

  @prop()
  @IsDefined()
  foo: string
}
export class TestController extends BaseCrudFactory({ model: TestModel }) {}

describe('BaseCrudFactory', () => {
  let testingModel: ReturnModelType<typeof TestModel>
  const proxy = createE2EApp({
    controllers: [TestController],
    providers: [...eventEmitterProvider],
    models: [TestModel],
    async pourData(modelMap) {
      const model = modelMap.get(TestModel)
      testingModel = model.model as any

      await model.model.create([
        {
          number: 1,
          foo: 'bar',
        },
      ])

      return async () => {
        return model.model.deleteMany({})
      }
    },
  })

  afterAll(() => {
    testingModel = null
  })

  test('GET /tests', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'GET',
      url: '/tests',
    })
    const data = res.json()
    expect(res.statusCode).toBe(200)

    data.data.forEach((item) => {
      delete item.id
      delete item.created
    })
    expect(data).toMatchSnapshot()
  })

  test('POST /tests', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'POST',
      url: '/tests',
      headers: {
        ...authPassHeader,
      },
      payload: {
        number: 2,
        foo: 'bar',
      },
    })
    const data = res.json()
    expect(res.statusCode).toBe(201)
    delete data.id
    delete data.created
    expect(data).toMatchSnapshot()
  })

  test('POST /tests should throw 422', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'POST',
      url: '/tests',
      headers: {
        ...authPassHeader,
      },
      payload: {
        number: true,
      },
    })
    expect(res.statusCode).toBe(422)
  })

  test('PATCH /tests/:id', async () => {
    const { app } = proxy
    const docId = await testingModel
      .findOne()
      .lean()
      .then((doc) => doc?.id)

    const res = await app.inject({
      method: 'PATCH',
      url: `/tests/${docId}`,
      headers: {
        ...authPassHeader,
      },
      payload: {
        number: 3,
      },
    })

    expect(res.statusCode).toBe(204)

    const doc = await testingModel.findById(docId).lean()
    expect(doc.number).toBe(3)
  })

  test('DELETE /tests/:id', async () => {
    const { app } = proxy
    const docId = await testingModel
      .findOne()
      .lean()
      .then((doc) => doc?.id)

    const res = await app.inject({
      method: 'delete',
      url: `/tests/${docId}`,
      headers: {
        ...authPassHeader,
      },
    })

    expect(res.statusCode).toBe(204)

    const docs = await testingModel.find()

    expect(docs.find((d) => d.id === docId)).toBe(undefined)
  })
})
