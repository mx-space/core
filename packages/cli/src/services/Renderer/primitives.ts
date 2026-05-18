export const isTTY = (stream: NodeJS.WriteStream): boolean =>
  Boolean(stream.isTTY)

export const color = (
  stream: NodeJS.WriteStream,
  code: number,
  text: string,
): string => {
  if (!isTTY(stream)) return text
  return `\x1B[${code}m${text}\x1B[0m`
}

export const writeStdout = (s: string): void => {
  process.stdout.write(s)
}

export const writeStderr = (s: string): void => {
  process.stderr.write(s)
}
