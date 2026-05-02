declare module 'mongodb' {
  export type Db = any
  export type ObjectId = {
    toHexString: () => string
    toString: () => string
  }
}
