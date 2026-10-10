import { test, expect } from 'claude-code/testing'

const PANE_PROPS = {
  title: 'z-tickets',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {}
}

const ROOT = '/store/tickets'
const HOURS_2 = new Date(Date.now() - 2 * 3600_000).toISOString()
const HOURS_5 = new Date(Date.now() - 5 * 3600_000).toISOString()

const STATE = JSON.stringify({
  id: 'zai-0198',
  status: 'verifying',
  request: 'sweep swp-0037: audit msgld-fe, tiers 1-4',
  origin: 'sweep:swp-0037',
  repos: ['msgld-fe'],
  createdAt: HOURS_5,
  updatedAt: HOURS_2,
  log: [
    { seat: 'ops', note: 'Ops handover to Audit.', at: HOURS_5 },
    { seat: 'fix', note: 'Fix complete on msgld-fe, three tier-4 findings on three branches.', at: HOURS_2 }
  ]
})

test('a ticket row presses open and presses shut', async ($, on) => {
  // Stand in for the ticket store: the mod reads it through $.fs, whose calls
  // come down the chain to these hooks.
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('fs.list', async () => ({ value: [{ name: 'zai-0198', kind: 'dir', size: 0, mtimeMs: 0, path: `${ROOT}/zai-0198` }] }) as never)
  on('fs.read', async () => ({ value: STATE }) as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    await $.command.run({
      command: 'z-tickets',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 }
    })

    const ui = await $.ui.mount({
      plugin: 'z-tickets',
      surface,
      component: 'Pane',
      requestId: 'z-tickets',
      props: PANE_PROPS
    })

    // Collapsed: the row is drawn, its detail is not.
    expect(await ui.find({ key: 'row-zai-0198' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /sweep:swp-0037/ })).toBeUndefined()

    await ui.press({ key: 'row-zai-0198' })

    // Expanded: origin, repos and the last log note are on screen.
    expect(await ui.find({ type: 'Text', text: /sweep:swp-0037/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /msgld-fe/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /three tier-4 findings/ })).toBeDefined()

    // Pressing the same row again collapses it.
    await ui.press({ key: 'row-zai-0198' })
    expect(await ui.find({ type: 'Text', text: /sweep:swp-0037/ })).toBeUndefined()

    await ui.unmount()
  }
})
