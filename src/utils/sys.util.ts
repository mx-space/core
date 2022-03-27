import { builtinModules } from 'module'

export const isBuiltinModule = (module: string, ignoreList: string[] = []) => {
  return (
    // @ts-ignore
    (builtinModules || (Object.keys(process.binding('natives')) as string[]))
      .filter(
        (x) =>
          !/^_|^(internal|v8|node-inspect)\/|\//.test(x) &&
          !ignoreList.includes(x),
      )
      .includes(module)
  )
}
