export type ZTicketLog = { seat: string; note: string; at: string }
export type ZTicket = {
  id: string
  status: string
  request: string
  updatedAt: string
  createdAt: string
  origin: string
  repos: string[]
  logLen: number
  last: ZTicketLog | null
}
export type ZTickets = { open: ZTicket[]; done: ZTicket[]; counts: Record<string, number> }

declare module 'claude-code' {
  interface PluginState {
    'z-tickets': { tickets: ZTickets; isDoneOpen: boolean; expandedId: string | null }
  }
}
