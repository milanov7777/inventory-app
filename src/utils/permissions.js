export function canEdit(session) {
  return session?.role === 'admin'
}

export function canAdd(session) {
  return session?.role === 'admin'
}

export function canDelete(session) {
  return session?.role === 'admin'
}

export function canPromote(session) {
  return session?.role === 'admin'
}

export function isAdmin(session) {
  return session?.role === 'admin'
}
