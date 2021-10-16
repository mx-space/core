import { UserModel } from '~/modules/user/user.model'

export const mockUser1: UserModel = {
  id: '1',
  name: 'John Doe',
  mail: 'example@ee.com',
  password: '**********',
  authCode: '*****',
  username: 'johndoe',
  created: new Date('2021/1/1 10:00:11'),
}

export const mockUser2: UserModel = {
  id: '2',
  name: 'Shawn Carter',
  mail: 'example@ee.com',
  password: '**********',
  authCode: '*****',
  username: 'shawn',
  created: new Date('2020/10/10 19:22:22'),
}
