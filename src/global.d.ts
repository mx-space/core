declare module 'yargs' {
  interface argv {
    $0: string
    [key: string]: any
  }
}
