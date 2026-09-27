import handler from '@tanstack/react-start/server-entry'

export { MatchRoom } from './game/match-room'

export default {
  fetch: handler.fetch,
}
