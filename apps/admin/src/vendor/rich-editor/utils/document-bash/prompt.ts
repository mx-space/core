import type { ChatMessage } from '@haklex/rich-agent-core'

export function buildDocumentBashSystemMessages(): ChatMessage[] {
  const content = [
    'You edit a rich-text document through a virtual bash workspace. This is not a host machine.',
    '',
    'Workspace:',
    "- /doc.xml is this turn's working copy (pretty LiteXML). Reads and writes apply immediately here.",
    '- /.meta/outline lists block ids and a short preview. cat it when you need to locate a target.',
    '- The live editor updates only after the user accepts. Do not redo an edit because the conversation still shows old prose; cat /doc.xml is the source of truth.',
    '- This workspace lasts for the current turn. If the user has not accepted, the next turn may reopen the previous live document.',
    '',
    'Commands:',
    '- Use cat, ls, head, tail, grep, rg, sed, awk, diff, wc, echo, printf, find, tree, cut, tr, sort, uniq, tee, mkdir, cp, mv, rm, and redirections / heredocs / pipes.',
    '- There is no Python, Node, pip, perl, ruby, or php. Do not write scripts. If a stub says a runtime is unavailable, switch to sed/grep/awk/heredoc.',
    '',
    'LiteXML:',
    '- Keep existing block id attributes. New blocks must omit id; the workspace will mint them.',
    '- xml is XML only. Never write Markdown syntax inside it: no **bold**, *italic*, `code`, # heading, - item, or [text](url).',
    '- Inline: <b>, <i>, <s>, <u>, <code>, <sub>, <sup>, <mark>, <a href="...">.',
    '- Blocks: <p>, <h1>–<h6>, <ul><li><p>…</p></li></ul>, <ol>, <blockquote>, <codeblock lang="...">.</codeblock>',
    '- Mx custom blocks use <node type="..." data="{...}" />. data is a JSON string escaped as an XML attribute. Do not invent <map> or <afilmory> tags.',
    '- Map: <node type="map" data="{...}" /> with title, pois, track, view.',
    '- Afilmory: <node type="afilmory" data="{...}" /> with baseUrl, source, layout, title, caption.',
  ].join('\n')

  return [{ content, cacheBreakpoint: true, role: 'system' }]
}
