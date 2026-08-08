import type { ZodCompilerPluginOptions } from 'zod-compiler'

export const zodCompilerOptions = {
  include: [
    'src/**/*.dto.ts',
    'src/**/*.schema.ts',
    'src/**/*.views.ts',
    'src/common/errors/exception.types.ts',
    'src/common/response/meta.types.ts',
    'src/common/zod/*.ts',
  ],
  // Config schema metadata is traversed at runtime for encryption, response
  // sanitization, and Admin form generation; keep that dynamic graph on Zod.
  exclude: ['src/modules/configs/configs.schema.ts'],
  output: 'compact',
  verbose: process.env.ZOD_COMPILER_VERBOSE === '1',
} satisfies ZodCompilerPluginOptions
