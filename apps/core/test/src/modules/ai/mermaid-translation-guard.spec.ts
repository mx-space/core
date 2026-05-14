import { describe, expect, it } from 'vitest'

import { validateMermaidTranslation } from '~/modules/ai/ai-translation/mermaid-translation-guard'

describe('validateMermaidTranslation', () => {
  it('accepts label-only translation that preserves syntax', () => {
    const source = `flowchart TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Continue]
  B -->|No| D[Stop]`
    const translated = `flowchart TD
  A[开始] --> B{决策}
  B -->|是| C[继续]
  B -->|否| D[停止]`
    expect(validateMermaidTranslation(source, translated).ok).toBe(true)
  })

  it('accepts unchanged diagram (LLM returned source as-is)', () => {
    const source = `graph LR
  A --> B`
    expect(validateMermaidTranslation(source, source).ok).toBe(true)
  })

  it('rejects keyword change (flowchart -> 流程图)', () => {
    const source = `flowchart TD
  A --> B`
    const translated = `流程图 TD
  A --> B`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/keyword_mismatch/)
  })

  it('rejects direction change (TD -> LR)', () => {
    const source = `flowchart TD
  A --> B`
    const translated = `flowchart LR
  A --> B`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/direction_mismatch/)
  })

  it('rejects arrow token kind change (-->  -> ===)', () => {
    const source = `flowchart TD
  A --> B`
    const translated = `flowchart TD
  A === B`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/connector_mismatch/)
  })

  it('rejects arrow count change (added an arrow)', () => {
    const source = `flowchart TD
  A --> B`
    const translated = `flowchart TD
  A --> B --> C`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/connector_mismatch/)
  })

  it('rejects unbalanced brackets (dropped closing bracket)', () => {
    const source = `flowchart TD
  A[Start] --> B[End]`
    const translated = `flowchart TD
  A[开始 --> B[结束]`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/delimiter_mismatch/)
  })

  it('rejects dropped quotes around label', () => {
    const source = `flowchart TD
  A["Hello, World"] --> B`
    const translated = `flowchart TD
  A[你好, 世界] --> B`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/delimiter_mismatch/)
  })

  it('rejects dropped flowchart edge-label pipe fences', () => {
    const source = `flowchart TD
  A -->|Yes| B`
    const translated = `flowchart TD
  A -->是 B`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/delimiter_mismatch:\|/)
  })

  it('rejects line count change (lines merged)', () => {
    const source = `flowchart TD
  A --> B
  B --> C`
    const translated = `flowchart TD
  A --> B; B --> C`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/line_count_mismatch|connector_mismatch/)
  })

  it('rejects translation that is way too long (length_ratio)', () => {
    const source = `flowchart TD
A --> B`
    const translated = `${'flowchart TD\nA --> B\n'.repeat(20)}`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
  })

  it('rejects empty translation', () => {
    const source = `flowchart TD
  A --> B`
    expect(validateMermaidTranslation(source, '').ok).toBe(false)
    expect(validateMermaidTranslation(source, '   \n  ').ok).toBe(false)
  })

  it('accepts sequence diagram label translation', () => {
    const source = `sequenceDiagram
  Alice->>Bob: Hello Bob, how are you?
  Bob-->>Alice: I am good, thanks!`
    const translated = `sequenceDiagram
  Alice->>Bob: 你好 Bob, 近况如何?
  Bob-->>Alice: 我很好, 谢谢!`
    expect(validateMermaidTranslation(source, translated).ok).toBe(true)
  })

  it('accepts dotted arrow translation', () => {
    const source = `flowchart LR
  A -.-> B
  B -.- C`
    const translated = `flowchart LR
  A -.-> B
  B -.- C`
    expect(validateMermaidTranslation(source, translated).ok).toBe(true)
  })

  it('rejects when dotted arrow becomes solid', () => {
    const source = `flowchart LR
  A -.-> B`
    const translated = `flowchart LR
  A --> B`
    const result = validateMermaidTranslation(source, translated)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/connector_mismatch/)
  })

  it('ignores comments when reading header keyword', () => {
    const source = `%% Diagram of the system
flowchart TD
  A --> B`
    const translated = `%% 系统图示
flowchart TD
  A --> B`
    expect(validateMermaidTranslation(source, translated).ok).toBe(true)
  })

  it('accepts class diagram label translation', () => {
    const source = `classDiagram
  class Animal {
    +String name
    +makeSound()
  }`
    const translated = `classDiagram
  class Animal {
    +String 名称
    +发声()
  }`
    expect(validateMermaidTranslation(source, translated).ok).toBe(true)
  })
})
