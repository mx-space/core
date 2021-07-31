import { Test, TestingModule } from '@nestjs/testing'
import { AppController } from './app.controller'

describe('AppController', () => {
  let appController: AppController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile()

    appController = app.get<AppController>(AppController)
  })

  describe('root', () => {
    it('should return has schema object', async () => {
      const obj = await appController.appInfo()
      expect(Object.keys(obj)).toStrictEqual(['name', 'version', 'hash'])
    })

    it('should return pong', () => {
      expect(appController.ping()).toBe('pong')
    })
  })
})
