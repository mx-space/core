import { zAllowedUrl, zNonEmptyString } from '~/common/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * User option schema (base fields for user)
 */
export const UserOptionSchema = z.object({
  introduce: zNonEmptyString.optional(),
  mail: z.string().email().optional(),
  url: z.string().url({ message: '请更正为正确的网址' }).optional(),
  name: z.string().optional(),
  avatar: zAllowedUrl.optional(),
  socialIds: z.record(z.string(), z.any()).optional(),
})

/**
 * User schema for registration
 */
export const UserSchema = UserOptionSchema.extend({
  username: zNonEmptyString.describe('用户名？'),
  password: zNonEmptyString.describe('密码？'),
})

export class UserDto extends createZodDto(UserSchema) {}

/**
 * Login schema
 */
export const LoginSchema = z.object({
  username: z.string({ message: '用户名？' }),
  password: z.string({ message: '密码？' }),
})

export class LoginDto extends createZodDto(LoginSchema) {}

/**
 * User patch schema
 */
export const UserPatchSchema = UserOptionSchema.extend({
  username: zNonEmptyString.optional(),
  password: zNonEmptyString.optional(),
})

export class UserPatchDto extends createZodDto(UserPatchSchema) {}

// Type exports
export type UserOptionInput = z.infer<typeof UserOptionSchema>
export type UserInput = z.infer<typeof UserSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type UserPatchInput = z.infer<typeof UserPatchSchema>
