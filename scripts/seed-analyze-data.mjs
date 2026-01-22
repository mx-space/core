#!/usr/bin/env node
/**
 * 向 Analyze 表插入 500 条测试数据
 * 运行: node scripts/seed-analyze-data.mjs
 */

import { MongoClient } from 'mongodb'

const MONGO_URI = process.env.MONGO_CONNECTION || 'mongodb://localhost:27017/mx-space'
const COLLECTION_NAME = 'analyzes'

// 模拟数据
const browsers = [
  { name: 'Chrome', version: '120.0.0' },
  { name: 'Firefox', version: '121.0' },
  { name: 'Safari', version: '17.0' },
  { name: 'Edge', version: '120.0.0' },
  { name: 'Opera', version: '105.0' },
]

const osList = [
  { name: 'Windows', version: '10' },
  { name: 'Windows', version: '11' },
  { name: 'macOS', version: '14.0' },
  { name: 'Linux', version: '' },
  { name: 'iOS', version: '17.0' },
  { name: 'Android', version: '14' },
]

const devices = [
  { type: 'desktop', vendor: '', model: '' },
  { type: 'desktop', vendor: '', model: '' },
  { type: 'desktop', vendor: '', model: '' },
  { type: 'mobile', vendor: 'Apple', model: 'iPhone' },
  { type: 'mobile', vendor: 'Samsung', model: 'Galaxy' },
  { type: 'tablet', vendor: 'Apple', model: 'iPad' },
]

const paths = [
  '/posts/hello-world',
  '/posts/typescript-tips',
  '/posts/vue-best-practices',
  '/notes/1',
  '/notes/2',
  '/notes/3',
  '/pages/about',
  '/pages/links',
  '/',
  '/feed',
  '/sitemap.xml',
]

const referers = [
  '', // 直接访问
  '',
  '',
  'https://www.google.com/search?q=blog',
  'https://www.google.com/search?q=vue',
  'https://www.baidu.com/s?wd=blog',
  'https://www.bing.com/search?q=typescript',
  'https://twitter.com/someuser/status/123',
  'https://x.com/someuser/status/456',
  'https://weibo.com/detail/123456',
  'https://www.zhihu.com/question/123456',
  'https://github.com/user/repo',
  'https://reddit.com/r/programming',
  'https://t.me/channel/123',
]

const countries = ['CN', 'US', 'JP', 'KR', 'GB', 'DE', 'FR', 'SG', 'HK', 'TW', null]

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomIP() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
}

function generateRecord(timestamp) {
  const browser = randomItem(browsers)
  const os = randomItem(osList)
  const device = randomItem(devices)

  return {
    ip: randomIP(),
    ua: {
      browser: { name: browser.name, version: browser.version, major: browser.version.split('.')[0] },
      os: { name: os.name, version: os.version },
      device: { type: device.type, vendor: device.vendor, model: device.model },
      engine: { name: 'Blink', version: '120.0.0' },
      cpu: { architecture: 'amd64' },
    },
    path: randomItem(paths),
    referer: randomItem(referers),
    country: randomItem(countries),
    timestamp: new Date(timestamp),
  }
}

async function main() {
  console.log('Connecting to MongoDB...')
  const client = new MongoClient(MONGO_URI)

  try {
    await client.connect()
    console.log('Connected!')

    const db = client.db()
    const collection = db.collection(COLLECTION_NAME)

    // 生成过去 7 天的数据
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    const records = []
    for (let i = 0; i < 500; i++) {
      const timestamp = sevenDaysAgo + Math.random() * (now - sevenDaysAgo)
      records.push(generateRecord(timestamp))
    }

    console.log(`Inserting ${records.length} records...`)
    const result = await collection.insertMany(records)
    console.log(`Inserted ${result.insertedCount} records successfully!`)

    // 显示统计信息
    const stats = await collection.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byDevice: [
            { $group: { _id: '$ua.device.type', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byBrowser: [
            { $group: { _id: '$ua.browser.name', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]).toArray()

    console.log('\n--- Statistics ---')
    console.log('Total records:', stats[0].total[0]?.count || 0)
    console.log('By device:', stats[0].byDevice)
    console.log('By browser:', stats[0].byBrowser)

  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  } finally {
    await client.close()
    console.log('\nDone!')
  }
}

main()
