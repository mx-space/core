export const importESM = (module: string) => {
  return new Function(module, 'return import(modulePath)')
}
