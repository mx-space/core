# Example: a comparison figure

A complete component that follows `SKILL.md`, `craft.md` and `motion.md`. Copy its structure, then replace the content and layout with what the article needs.

What to notice:

- **Resting frame tells the story.** With no input it already shows the focal value large, the comparison as bars, and the focused row in the accent.
- **Real strings:** the focal label and value, three names, three values, two options, the caption. Nothing else.
- **No outer chrome.** One quiet surface, a hairline, 12px radius, no shadow, no title.
- **Tokens with `light-dark()`.** The host sets `color-scheme` on the container, so `host.theme` needs no handling and a theme switch needs no re-render.
- **Declared font.** The host container is `all: initial`, so the root sets `font` itself and buttons use `font: inherit`.
- **Narrow widths.** `container-type: inline-size` on the container plus a `@container` rule; the header wraps instead of shrinking.
- **Motion with a cause.** Only the bar widths travel, only after the reader picks an option, and only without reduced motion.
- **Updates in place.** `render()` reuses the existing nodes, so a props change from the writer's form animates instead of rebuilding.
- **Cleanup.** `unmount` removes the listener and every node it added.

Props schema to pass alongside:

```json
{
  "type": "object",
  "properties": {
    "caption": { "type": "string", "title": "Caption", "default": "Cold start time by runtime" },
    "unit": { "type": "string", "title": "Unit", "default": "ms" },
    "focus": { "type": "string", "title": "Highlighted item", "default": "Bun" },
    "options": {
      "type": "array",
      "title": "Datasets",
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "items": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": { "name": { "type": "string" }, "value": { "type": "number" } },
              "required": ["name", "value"]
            }
          }
        },
        "required": ["label", "items"]
      }
    }
  }
}
```

Source:

```js
const DEFAULTS = {
  caption: 'Cold start time by runtime',
  unit: 'ms',
  focus: 'Bun',
  options: [
    {
      label: 'Small app',
      items: [
        { name: 'Node', value: 42 },
        { name: 'Deno', value: 31 },
        { name: 'Bun', value: 12 },
      ],
    },
    {
      label: 'Large app',
      items: [
        { name: 'Node', value: 310 },
        { name: 'Deno', value: 240 },
        { name: 'Bun', value: 95 },
      ],
    },
  ],
}

const STYLE = `
.root {
  --fg: light-dark(#18181b, #f4f4f5);
  --fg-muted: light-dark(#52525b, #a1a1aa);
  --fg-faint: light-dark(#a1a1aa, #52525b);
  --surface: light-dark(#fafafa, #18181b);
  --surface-raised: light-dark(#ffffff, #27272a);
  --line: light-dark(#e4e4e7, #3f3f46);
  --accent: light-dark(#2563eb, #60a5fa);
  --accent-fg: light-dark(#ffffff, #0b1220);
  --bar: light-dark(#d4d4d8, #3f3f46);
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  gap: 16px;
  font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
}
.focus { display: grid; gap: 2px; }
.focus-label { color: var(--fg-muted); font-size: 13px; }
.focus-value {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.focus-unit { font-size: 15px; font-weight: 500; color: var(--fg-muted); margin-left: 4px; }
.segmented {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  border-radius: 8px;
  background: var(--surface-raised);
  border: 1px solid var(--line);
}
.segmented button {
  font: inherit;
  font-size: 13px;
  color: var(--fg-muted);
  background: transparent;
  border: 0;
  border-radius: 6px;
  min-height: 28px;
  padding: 0 10px;
  cursor: pointer;
}
.segmented button[aria-pressed='true'] { background: var(--accent); color: var(--accent-fg); }
.segmented button:focus-visible, .row:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rows { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.row {
  display: grid;
  grid-template-columns: 56px 1fr 64px;
  align-items: center;
  gap: 12px;
}
.name { color: var(--fg-muted); }
.track { height: 10px; border-radius: 5px; overflow: hidden; }
.fill {
  height: 100%;
  border-radius: 5px;
  background: var(--bar);
}
.row[data-focus='true'] .name { color: var(--fg); font-weight: 600; }
.row[data-focus='true'] .fill { background: var(--accent); }
.value { text-align: right; font-variant-numeric: tabular-nums; color: var(--fg-muted); }
.caption { color: var(--fg-muted); font-size: 13px; }
@media (prefers-reduced-motion: no-preference) {
  .fill { transition: width 450ms cubic-bezier(0.45, 0, 0.1, 1), background-color 150ms; }
}
@container (max-width: 380px) {
  .root { padding: 12px; }
  .row { grid-template-columns: 48px 1fr 56px; }
}
`

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function normalize(props) {
  const merged = { ...DEFAULTS, ...props }
  const options = Array.isArray(merged.options) && merged.options.length
    ? merged.options
    : DEFAULTS.options
  return { ...merged, options }
}

export default {
  mount(container, input) {
    container.style.containerType = 'inline-size'
    const style = el('style')
    style.textContent = STYLE
    const root = el('figure', 'root')
    root.style.margin = '0'
    container.append(style, root)

    let props = normalize(input.props)
    let selected = 0

    const head = el('div', 'head')
    const focus = el('div', 'focus')
    const focusLabel = el('div', 'focus-label')
    const focusValue = el('div', 'focus-value')
    focus.append(focusLabel, focusValue)
    const segmented = el('div', 'segmented')
    segmented.setAttribute('role', 'group')
    head.append(focus, segmented)
    const rows = el('ul', 'rows')
    const caption = el('figcaption', 'caption')
    root.append(head, rows, caption)

    const onSelect = (event) => {
      const button = event.target.closest('button[data-index]')
      if (!button) return
      selected = Number(button.dataset.index)
      render()
    }
    segmented.addEventListener('click', onSelect)

    function render() {
      selected = Math.min(selected, props.options.length - 1)
      const option = props.options[selected]
      const items = option.items ?? []
      const max = Math.max(1, ...items.map((item) => item.value))
      const focused = items.find((item) => item.name === props.focus) ?? items[0]

      segmented.setAttribute('aria-label', props.caption)
      if (segmented.childElementCount !== props.options.length) {
        segmented.replaceChildren(
          ...props.options.map((entry, index) => {
            const button = el('button', '', entry.label)
            button.type = 'button'
            button.dataset.index = String(index)
            return button
          }),
        )
      }
      for (const button of segmented.children) {
        button.textContent = props.options[Number(button.dataset.index)].label
        button.setAttribute('aria-pressed', String(button.dataset.index === String(selected)))
      }

      focusLabel.textContent = focused ? `${focused.name}, ${option.label.toLowerCase()}` : ''
      focusValue.replaceChildren(
        document.createTextNode(focused ? String(focused.value) : '–'),
        el('span', 'focus-unit', props.unit),
      )

      while (rows.childElementCount > items.length) rows.lastElementChild.remove()
      while (rows.childElementCount < items.length) {
        const row = el('li', 'row')
        const track = el('div', 'track')
        track.append(el('div', 'fill'))
        row.append(el('div', 'name'), track, el('div', 'value'))
        rows.append(row)
      }
      items.forEach((item, index) => {
        const row = rows.children[index]
        row.dataset.focus = String(item === focused)
        row.children[0].textContent = item.name
        row.querySelector('.fill').style.width = `${(item.value / max) * 100}%`
        row.children[2].textContent = `${item.value} ${props.unit}`
      })

      caption.textContent = props.caption
    }

    render()

    return {
      update(next) {
        props = normalize(next.props)
        render()
      },
      unmount() {
        segmented.removeEventListener('click', onSelect)
        style.remove()
        root.remove()
        container.style.containerType = ''
      },
    }
  },
}
```
