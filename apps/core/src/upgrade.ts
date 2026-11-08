import 'dotenv-expand/config'

import { runUpgradeCli } from './upgrade/cli'

process.exitCode = await runUpgradeCli(process.argv.slice(2))
