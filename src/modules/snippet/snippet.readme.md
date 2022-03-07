
# 数据区块 (Snippet)

拟定于存储一些动态扩展配置. 一期实现存储 JSON 和 plain text 的区块

二期实现低配云函数

拟定:

JSON: 

```
input: json `{"foo":"bar"}`


output: 

{
  metatype: null,
  type: 'json',
  data: {
    foo: 'bar'
  },
  raw: '{"foo":"bar"}',
  id: xx
}
```

serverless function

```
input: `module.exports = ctx => { return 'foo' }`

output: 

{
  raw: `module.exports = ctx => { return 'foo' }`,
  data: 'foo',
  ....

}


```



# Serverless Function

```js

function handle() {}

```