import { GraphQLModule } from '@nestjs/graphql'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { join } from 'path'
import { AppResolver } from '~/app.resolver'
import { fastifyApp } from '~/common/adapters/fastify.adapter'

describe('GQL test (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot({
          autoSchemaFile: join(process.cwd(), 'schema.gql'),
          context: ({ req }) => ({ req }),
        }),
        AppResolver,
      ],
    }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  it('GET /graphql', () => {
    return app
      .inject({
        method: 'post',
        url: '/graphql',
        payload: {
          operationName: null,
          variables: {},
          query: ` {
            sayHello
          }`,
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(200)
        expect(res.json()).toStrictEqual({
          data: {
            sayHello: 'Hello World!',
          },
        })
      })
  })

  afterAll(async () => {
    await app.close()
  })
})
