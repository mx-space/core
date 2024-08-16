const { resolve } = require('node:path')
const axios = require('axios')
const { fs } = require('zx-cjs')
const {
  dashboard: { repo },
} = require('./package.json')
const Package = require('./package.json')
const endpoint = `https://api.github.com/repos/${repo}/releases/latest`

const latestVersion = async () => {
  const res = await axios.get(endpoint).catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
  return res.data.tag_name.replace(/^v/, '')
}
async function main() {
  const version = await latestVersion()

  Package.dashboard.version = version

  await fs.writeFile(
    resolve(__dirname, './package.json'),
    JSON.stringify(Package, null, 2),
  )

  console.log('Updated version to', version)
}

main()
