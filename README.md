# MX server next generation

[![wakatime](https://wakatime.com/badge/github/mx-space/server-next.svg)](https://wakatime.com/badge/github/mx-space/server-next)

Quick usage

Requirement:
  - Node.js 16+

If you're using Ubuntu you can just download the latest [release](https://github.com/mx-space/server-next/releases/latest) and unzip it.

```
node index.js
```

---

Interceptor Dataflow

```
ResponseInterceptor -> JSONSerializeInterceptor -> CountingInterceptor -> HttpCacheInterceptor
```

---

2021-08-31

开始写了


## Reference

[nodepress](https://github.com/surmon-china/nodepress)