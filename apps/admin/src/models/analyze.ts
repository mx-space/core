export declare namespace UA {
  export interface Browser {
    name: string
    version: string
    major: string
  }

  export interface Engine {
    name: string
    version: string
  }

  export interface Os {
    name: string
    version: string
  }

  export interface Ua {
    ua: string
    browser?: Browser
    engine?: Engine
    os?: Os
  }
  export interface Root {
    id: string
    ip?: string
    ua: Ua
    timestamp: Date
    path?: string
  }
}
