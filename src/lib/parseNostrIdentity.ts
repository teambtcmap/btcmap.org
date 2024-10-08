import {decode} from 'nostr-tools/nip19'

const npubRegex = /[\x21-\x7E]{1,83}1[023456789acdefghjklmnpqrstuvwxyz]{6,}/

export const parseNostrIdentity = profileJson => {
  const {description = ''} = profileJson
  const matches = description.match(npubRegex)
  if (!matches) return {exists: false}
  const [npub] = matches
  try {
    const {data, type} = decode(npub)
    return {
      exists: true,
      type,
      npub,
      hex: data,
      checksum: 'ok',
    }
  } catch (error) {
    return {exists: true, checksum: 'failed', error}
  }
}
