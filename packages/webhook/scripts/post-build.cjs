const fs = require('node:fs')
const path = require('node:path')

// Function to replace content in a file
function replaceContent(filePath, searchValue, replaceValue) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file from disk: ${err}`)
    } else {
      // Replace the text
      const result = data.replace(searchValue, replaceValue)

      // Write the file back
      fs.writeFile(filePath, result, 'utf8', (writeErr) => {
        if (writeErr) console.error(`Error writing file: ${writeErr}`)
        else console.log(`Updated file: ${filePath}`)
      })
    }
  })
}

// File paths
const files = ['dist/index.d.ts', 'dist/index.d.cts']

// The string to be replaced and its replacement
const searchValue = "import { Ref } from '@typegoose/typegoose';"
const replaceValue = 'type Ref <T> = unknown;'

// Apply the replacement for each file
files.forEach((file) => {
  const filePath = path.join(__dirname, '../', file)
  replaceContent(filePath, searchValue, replaceValue)
})
