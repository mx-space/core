import v8 from 'node:v8'
import fs from 'node:fs'
import { TEMP_DIR } from './constants/path.constant'

export function registerForMemoryDump() {
  function createHeapSnapshot() {
    const snapshotStream = v8.getHeapSnapshot()
    const localeDate = new Date().toLocaleString()
    const fileName = `${TEMP_DIR}/HeapSnapshot-${localeDate}.heapsnapshot`
    const fileStream = fs.createWriteStream(fileName)
    snapshotStream.pipe(fileStream).on('finish', () => {
      console.log('Heap snapshot saved to', fileName)
    })
  }

  process.on('SIGUSR2', () => {
    console.log('SIGUSR2 received, creating heap snapshot...')
    createHeapSnapshot()
  })
}
