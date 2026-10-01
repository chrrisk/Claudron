import { useMemo, useState } from 'react'
import { diffLines, diffStats, findStartLine, withContext, type DiffLine } from '@shared/diff'
import type { ConvItem } from '../store/agent'
import { FileIcon, PencilIcon, SearchIcon, TerminalIcon, ToolIcon } from './icons'

type ToolItem = Extract<ConvItem, { kind: 'tool' }>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Paths are shown relative to the project when possible. */
function rel(path: string, cwd: string): string {
  if (cwd && path.startsWith(cwd)) return path.slice(cwd.length).replace(/^[\\/]/, '') || path
  return path
}

function lineCount(text: string | undefined): number | null {
  if (!text) return null
  const n = text.split('\n').filter((l) => /^\s*\d+[\t→]/.test(l)).length
  return n || null
}

function Diff({ lines }: { lines: (DiffLine | { kind: 'gap' })[] }): React.JSX.Element {
  return (
    <div className="diff">
      {lines.map((l, i) =>
        l.kind === 'gap' ? (
          <div key={i} className="diff-line gap">
            ⋯
          </div>
        ) : (
          <div key={i} className={`diff-line ${l.kind}`}>
            <span className="no">{l.kind === 'del' ? l.oldNo : l.newNo}</span>
            <span className="sign">{l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}</span>
            <span className="code">{l.text || ' '}</span>
          </div>
        )
      )}
    </div>
  )
}

function EditCard({ item, cwd }: { item: ToolItem; cwd: string }): React.JSX.Element {
  const { input, result } = item
  const path = str(input.file_path)
  const lines = useMemo(() => {
    if (item.name === 'Write') return diffLines('', str(input.content))
    const edits: { old_string?: unknown; new_string?: unknown }[] =
      item.name === 'MultiEdit' && Array.isArray(input.edits) ? (input.edits as never) : [input]
    return edits.flatMap((e) => {
      const start = findStartLine(result?.text, str(e.new_string)) ?? 1
      return diffLines(str(e.old_string), str(e.new_string), start)
    })
  }, [item.name, input, result?.text])
  const stats = diffStats(lines)
  const shown = withContext(lines, 2)
  const [open, setOpen] = useState(shown.length <= 40)

  return (
    <div className={`tool-card edit ${result?.isError ? 'failed' : ''}`}>
      <button className="tool-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <PencilIcon stroke="var(--accent)" />
        <span className="tool-name accent">{item.name === 'Write' ? 'Write' : 'Edit'}</span>
        <span className="tool-arg">{rel(path, cwd)}</span>
        <span className="tool-meta">
          <span className="ok">+{stats.added}</span> <span className="bad">-{stats.removed}</span>
        </span>
      </button>
      {open && <Diff lines={item.name === 'Write' ? lines.slice(0, 60) : shown} />}
      {result?.isError && <div className="tool-error">{result.text}</div>}
    </div>
  )
}

function BashCard({ item }: { item: ToolItem }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const out = item.result?.text ?? ''
  return (
    <div className={`tool-card ${item.result?.isError ? 'failed' : ''}`}>
      <button className="tool-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={!out}>
        <TerminalIcon stroke="var(--ok)" />
        <span className="tool-name ok">Bash</span>
        <span className="tool-arg">{str(item.input.command)}</span>
        <span className="tool-meta">{item.result ? (item.result.isError ? 'failed' : 'done') : 'running'}</span>
      </button>
      {open && out && <pre className="tool-output">{out}</pre>}
    </div>
  )
}

function OneLine({
  icon,
  name,
  arg,
  meta,
  tone = 'violet',
  item
}: {
  icon: React.ReactNode
  name: string
  arg: string
  meta?: string | null
  tone?: string
  item: ToolItem
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const out = item.result?.text ?? ''
  return (
    <div className={`tool-card ${item.result?.isError ? 'failed' : ''}`}>
      <button className="tool-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={!out}>
        {icon}
        <span className={`tool-name ${tone}`}>{name}</span>
        <span className="tool-arg">{arg}</span>
        {meta && <span className="tool-meta">{meta}</span>}
      </button>
      {open && out && <pre className="tool-output">{out.slice(0, 8000)}</pre>}
    </div>
  )
}

function TodoCard({ item }: { item: ToolItem }): React.JSX.Element {
  const todos = Array.isArray(item.input.todos)
    ? (item.input.todos as { content?: string; status?: string }[])
    : []
  return (
    <div className="tool-card todo">
      <div className="tool-head static">
        <ToolIcon stroke="var(--violet)" />
        <span className="tool-name violet">Plan</span>
        <span className="tool-meta">
          {todos.filter((t) => t.status === 'completed').length}/{todos.length}
        </span>
      </div>
      <ul className="todos">
        {todos.map((t, i) => (
          <li key={i} className={t.status}>
            <span className="box">{t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '◐' : ''}</span>
            {t.content}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ToolCard({ item, cwd }: { item: ToolItem; cwd: string }): React.JSX.Element {
  const i = item.input
  switch (item.name) {
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
      return <EditCard item={item} cwd={cwd} />
    case 'Bash':
      return <BashCard item={item} />
    case 'Read': {
      const n = lineCount(item.result?.text)
      return (
        <OneLine
          item={item}
          icon={<FileIcon stroke="var(--violet)" />}
          name="Read"
          arg={rel(str(i.file_path), cwd)}
          meta={n ? `${n} lines` : item.result ? null : 'reading'}
        />
      )
    }
    case 'Grep':
    case 'Glob':
      return (
        <OneLine
          item={item}
          icon={<SearchIcon stroke="var(--violet)" />}
          name={item.name}
          arg={str(i.pattern)}
          meta={str(i.path) ? rel(str(i.path), cwd) : null}
        />
      )
    case 'TodoWrite':
      return <TodoCard item={item} />
    case 'WebFetch':
    case 'WebSearch':
      return (
        <OneLine
          item={item}
          icon={<SearchIcon stroke="var(--violet)" />}
          name={item.name}
          arg={str(i.url) || str(i.query)}
        />
      )
    case 'Task':
    case 'Agent':
      return (
        <OneLine
          item={item}
          icon={<ToolIcon stroke="var(--violet)" />}
          name="Agent"
          arg={str(i.description) || str(i.prompt).slice(0, 80)}
          meta={item.result ? 'done' : 'working'}
        />
      )
    default:
      return (
        <OneLine
          item={item}
          icon={<ToolIcon stroke="var(--muted)" />}
          name={item.name.replace(/^mcp__/, '').replace(/__/g, ' · ')}
          arg={summarize(i)}
          tone="muted"
        />
      )
  }
}

function summarize(input: Record<string, unknown>): string {
  const first = Object.values(input).find((v) => typeof v === 'string') as string | undefined
  return first ? first.slice(0, 100) : ''
}
