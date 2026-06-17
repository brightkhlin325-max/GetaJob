export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { taskId } = req.query;
  if (!taskId) {
    return res.status(400).json({ success: false, error: 'taskId is required' });
  }

  // Ensure global task object exists
  global.scrapeTasks = global.scrapeTasks || {};

  // Housekeeping: Clean up tasks updated more than 10 minutes ago to prevent memory leak
  const NOW = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;
  for (const [id, task] of Object.entries(global.scrapeTasks)) {
    if (task.updatedAt && (NOW - task.updatedAt > TEN_MINUTES)) {
      delete global.scrapeTasks[id];
    }
  }

  const task = global.scrapeTasks[taskId];
  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found or expired' });
  }

  return res.status(200).json({
    success: true,
    data: {
      status: task.status,
      progress: task.progress,
      importedCount: task.importedCount,
      errors: task.errors || []
    }
  });
}
