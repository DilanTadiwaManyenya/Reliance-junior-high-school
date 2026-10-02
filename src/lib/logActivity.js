// Audit delivery is deliberately best-effort: it must never delay or fail a user action.
export function logActivity(supabase, user, profile, event) {
  if (!supabase || !user?.id) return
  const payload = {
    actor_id: user.id,
    actor_role: profile?.active_role ?? profile?.role ?? null,
    action_type: event.actionType,
    description: event.description ?? null,
    target_table: event.targetTable ?? null,
    target_id: event.targetId ?? null,
    metadata: event.metadata ?? {},
  }
  void supabase.from('audit_logs').insert(payload).then(({ error }) => {
    if (error) console.warn('Activity log delivery failed:', error.message)
  })
}
