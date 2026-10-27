export async function runBulkLearnerAction(client, learners, action, reason, onProgress = () => {}) {
  if (!['disable', 'delete'].includes(action)) throw new Error('Choose disable or delete.');
  if (reason.trim().length < 5) throw new Error('Enter a reason of at least five characters.');
  const rows = [...new Map(learners.map(row => [row.id, row])).values()];
  if (!rows.length || rows.some(row => !row.id || row.status !== (action === 'delete' ? 'inactive' : 'active'))) {
    throw new Error('Refresh the roster and select learners with the correct status.');
  }
  const results = [];
  for (const row of rows) {
    try {
      const response = action === 'disable'
        ? await client.rpc('correct_assigned_learner', { p_student: row.id, p_details: { disable_reason: reason.trim() } })
        : await client.rpc('manage_disabled_learner', { p_student: row.id, p_action: 'delete', p_reason: reason.trim() });
      const { error } = response;
      if (error && (response.status === 0 || /failed to fetch|network|timeout|timed out|abort|fetch failed/i.test(error.message || ''))) {
        results.push({ id: row.id, name: row.full_name, status: 'unknown', message: 'Could not confirm the result. Refresh the roster before retrying. Remaining learners were not processed.' });
        break;
      }
      results.push({ id: row.id, name: row.full_name, status: error ? 'blocked' : 'success', message: error?.message });
      onProgress(results.length, rows.length);
    } catch {
      // A lost response can mean the write succeeded. Stop rather than retry it.
      results.push({ id: row.id, name: row.full_name, status: 'unknown', message: 'Could not confirm the result. Refresh the roster before retrying. Remaining learners were not processed.' });
      break;
    }
  }
  return results;
}
