import { builtinModules } from 'module'

export const isBuiltinModule = (module: string, ignoreList = []) => {
  // @ts-ignore
  return (builtinModules || Object.keys(process.binding('natives')))
    .filter(
      (x) =>
        !/^_|^(internal|v8|node-inspect)\/|\//.test(x) &&
        !ignoreList.includes(x),
    )
    .includes(module)
}
