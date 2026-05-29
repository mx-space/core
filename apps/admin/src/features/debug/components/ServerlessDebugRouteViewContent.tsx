import { Code2, Play, RotateCcw, Terminal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { postJson } from '~/api/http'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { defaultServerlessFunction } from '~/models/snippet'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'
import { Scroll } from '~/ui/primitives/scroll'
import { TextArea } from '~/ui/primitives/text-field'

export function ServerlessDebugRouteViewContent() {
  const [code, setCode] = useLocalStorageState(
    'debug-serverless',
    defaultServerlessFunction,
  )
  const [result, setResult] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  const lineCount = useMemo(() => code.split('\n').length, [code])

  const runFunction = async () => {
    setIsRunning(true)

    try {
      const response = await postJson<unknown, { function: string }>(
        '/debug/function',
        {
          function: code,
        },
      )

      const formattedResult = formatResult(response)
      setResult(formattedResult)
      toast.success('Serverless function executed')
    } catch (error) {
      const message = readErrorMessage(error)
      setResult(`Error: ${message}`)
      toast.error('Serverless function failed', {
        description: message,
      })
    } finally {
      setIsRunning(false)
    }
  }

  const resetFunction = () => {
    setCode(defaultServerlessFunction)
    setResult('')
  }

  return (
    <AppPage>
      <PageHeader
        description="Execute the development serverless function."
        title="Serverless Debug"
      />
      <Scroll
        className="min-h-0 flex-1"
        innerClassName="mx-auto grid w-full max-w-7xl gap-6 p-4 xl:grid-cols-[minmax(0,1fr)_420px]"
      >
        <Panel
          description="Edit and execute the development serverless function from the React runtime."
          title={
            <span className="inline-flex items-center gap-2">
              <Code2 aria-hidden="true" className="size-4" />
              Function editor
            </span>
          }
        >
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {lineCount} lines saved in local storage.
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={resetFunction} type="button" variant="subtle">
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Reset
                </Button>
                <Button
                  disabled={isRunning}
                  onClick={runFunction}
                  type="button"
                >
                  <Play aria-hidden="true" className="size-4" />
                  {isRunning ? 'Running' : 'Run'}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4">
            <TextArea
              controlClassName="min-h-[620px] resize-y p-3 font-mono text-sm leading-6"
              onChange={setCode}
              spellCheck={false}
              value={code}
            />
          </div>
        </Panel>

        <Panel
          description="The latest execution response or error."
          title={
            <span className="inline-flex items-center gap-2">
              <Terminal aria-hidden="true" className="size-4" />
              Preview
            </span>
          }
        >
          <div className="p-4">
            <Scroll
              className="rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
              orientation="both"
            >
              <pre className="min-h-[620px] p-3 font-mono text-xs leading-5 text-neutral-800 dark:text-neutral-100">
                {result || 'Run the function to inspect its response.'}
              </pre>
            </Scroll>
          </div>
        </Panel>
      </Scroll>
    </AppPage>
  )
}

function formatResult(value: unknown) {
  if (typeof value === 'string') return value

  return JSON.stringify(value, null, 2)
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}
