import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ZTicket, ZTicketLog, ZTickets } from '../types'

const DEFAULT_ROOT = '/Users/sabiridwan/.zyncai/tickets'
const REFRESH_MS = 15000
const PANE = 'z-tickets'
const ORDER = ['information_missing', 'on_hold', 'intake', 'auditing', 'fixing', 'verifying', 'pr_open']
const COLORS: Record<string, string> = {
  information_missing: 'red',
  on_hold: 'yellow',
  intake: 'cyan',
  auditing: 'magenta',
  fixing: 'blue',
  verifying: 'blue',
  pr_open: 'green'
}
const PER_GROUP = 4
const DONE_SHOWN = 8
const TITLE = 'z-tickets'
// Kept short: the whole store is re-read every REFRESH_MS and held in state.
const NOTE_MAX = 400
const REQUEST_MAX = 300

const tickets = atom({ plugin: 'z-tickets', key: 'tickets' } as const, {
  open: [],
  done: [],
  counts: {}
} as ZTickets)
const isDoneOpen = atom({ plugin: 'z-tickets', key: 'isDoneOpen' } as const, false)
// Which ticket row is expanded; one at a time, null when every row is collapsed.
const expandedId = atom({ plugin: 'z-tickets', key: 'expandedId' } as const, null as string | null)

const title = (request: string) => {
  const flat = request.replace(/\s+/g, ' ').replace(/ FINDINGS.*$/, '').trim()
  return flat.replace(/^[a-z][\w-]*: /i, '')
}
const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (!Number.isFinite(mins)) return ''
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
const flat = (text: string, max: number) => clip(String(text ?? '').replace(/\s+/g, ' ').trim(), max)

async function scan($: any, root: string): Promise<ZTickets> {
  const entries = await $.fs.list(root).catch(() => [])
  const rows = await Promise.all(
    entries
      .filter((entry: { name: string }) => /^zai-\d+$/.test(entry.name))
      .map(async (entry: { name: string }): Promise<ZTicket | null> => {
        try {
          const state = JSON.parse(await $.fs.read(`${root}/${entry.name}/state.json`))
          const log = Array.isArray(state.log) ? state.log : []
          const tail = log.length > 0 ? log[log.length - 1] : null
          const last: ZTicketLog | null = tail
            ? {
                seat: String(tail.seat ?? '?'),
                note: flat(String(tail.note ?? ''), NOTE_MAX),
                at: String(tail.at ?? '')
              }
            : null
          return {
            id: String(state.id ?? entry.name),
            status: String(state.status ?? '?'),
            request: String(state.request ?? ''),
            updatedAt: String(state.updatedAt ?? ''),
            createdAt: String(state.createdAt ?? ''),
            origin: String(state.origin ?? ''),
            repos: Array.isArray(state.repos) ? state.repos.map((r: unknown) => String(r)) : [],
            logLen: log.length,
            last
          }
        } catch {
          return null
        }
      })
  )
  const all = rows
    .filter((row): row is ZTicket => row !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const open = all.filter(row => row.status !== 'completed')
  const done = all.filter(row => row.status === 'completed')
  const counts: Record<string, number> = {}
  for (const row of open) counts[row.status] = (counts[row.status] ?? 0) + 1
  return { open, done, counts }
}

async function refresh($: any, root: string): Promise<void> {
  const next = await scan($, root)
  await update($, tickets, () => next)
  $.ui.status(next.open.length === 0 ? undefined : `z: ${next.open.length} open`)
}

export const register: Register = (on, options) => {
  const root = typeof options?.storeRoot === 'string' && options.storeRoot ? options.storeRoot : DEFAULT_ROOT
  let timer: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'z-tickets', description: 'Open the z-tickets side panel' })
    void $.ui.open({ id: PANE, title: TITLE })
    await refresh($, root)
    timer?.cancel()
    timer = $.clock.every(REFRESH_MS, () => {
      refresh($, root).catch(() => {})
    })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($, root).catch(() => {})
    return next(e)
  })

  on('command.run', { command: 'z-tickets' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await refresh($, root).catch(() => {})
    return { text: 'z-tickets panel opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const data = await read($, tickets)
    const showDone = await read($, isDoneOpen)
    const expanded = await read($, expandedId)

    if (data.open.length === 0 && data.done.length === 0) {
      return <Text dimColor>No tickets.</Text>
    }

    const toggle = (id: string) => () => {
      void update($, expandedId, current => (current === id ? null : id))
    }

    // The expanded body of one ticket: what the list row cannot carry.
    const detail = (ticket: ZTicket) => (
      <Box flexDirection="column" marginLeft={2} marginBottom={1}>
        <Text wrap="wrap">{flat(ticket.request, REQUEST_MAX)}</Text>
        <Text dimColor>
          status <Text color={COLORS[ticket.status] ?? 'gray'}>{ticket.status.replace(/_/g, ' ')}</Text>
        </Text>
        <Text dimColor>repos {ticket.repos.join(', ') || '—'}</Text>
        <Text dimColor>origin {ticket.origin || '—'}</Text>
        <Text dimColor>
          opened {ticket.createdAt ? `${ago(ticket.createdAt)} ago` : '—'} · {ticket.logLen} log
          {ticket.logLen === 1 ? ' entry' : ' entries'}
        </Text>
        {ticket.last ? (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>
              last {ticket.last.seat} · {ago(ticket.last.at)}
            </Text>
            <Text wrap="wrap">{ticket.last.note || '—'}</Text>
          </Box>
        ) : (
          <Text dimColor>no log entries yet</Text>
        )}
      </Box>
    )

    // One pressable row. Pressing it expands this ticket; pressing it again
    // collapses it. Button children must be text, so the meta line and the
    // detail sit under the Button, not inside it.
    const row = (ticket: ZTicket, dim: boolean) => (
      <Box key={ticket.id} flexDirection="column" marginLeft={2}>
        <Button
          key={`row-${ticket.id}`}
          plain
          dimColor={dim}
          label={`${expanded === ticket.id ? '▾' : '▸'} ${clip(title(ticket.request), 54)}`}
          onPress={toggle(ticket.id)}
        />
        <Text dimColor>
          {ticket.id.replace('zai-', '#')} · {ago(ticket.updatedAt)}
        </Text>
        {expanded === ticket.id && detail(ticket)}
      </Box>
    )

    const known = ORDER.filter(status => data.counts[status])
    const rest = Object.keys(data.counts).filter(status => !ORDER.includes(status))
    const groups = [...known, ...rest].map(status => ({
      status,
      rows: data.open.filter(ticket => ticket.status === status)
    }))

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold>Tickets </Text>
          <Text dimColor>{data.open.length} open</Text>
        </Box>
        {groups.map(group => (
          <Box key={group.status} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={COLORS[group.status] ?? 'gray'}>● </Text>
              <Text bold>{group.status.replace(/_/g, ' ')} </Text>
              <Text dimColor>{group.rows.length}</Text>
            </Box>
            {group.rows.slice(0, PER_GROUP).map(ticket => row(ticket, false))}
            {group.rows.length > PER_GROUP && (
              <Box marginLeft={2}>
                <Text dimColor>+{group.rows.length - PER_GROUP} more</Text>
              </Box>
            )}
          </Box>
        ))}
        {data.done.length > 0 && (
          <Box flexDirection="column">
            <Button
              key="done"
              label={`${showDone ? '▾' : '▸'} completed ${data.done.length}`}
              onPress={() => update($, isDoneOpen, open => !open)}
            />
            {showDone && data.done.slice(0, DONE_SHOWN).map(ticket => row(ticket, true))}
            {showDone && data.done.length > DONE_SHOWN && (
              <Box marginLeft={2}>
                <Text dimColor>+{data.done.length - DONE_SHOWN} more</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
