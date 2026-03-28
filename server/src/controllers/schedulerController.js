const { runAutoDebit } = require('../scheduler/autoDebit');

const runScheduler = async (req, res) => {
  const secret = req.headers['x-scheduler-secret'];
  if (!secret || secret !== process.env.SCHEDULER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const day = req.body?.day ?? new Date().getDate();

  try {
    await runAutoDebit(day);
    res.json({ message: 'AutoDebit complete', day });
  } catch (err) {
    console.error('[Scheduler] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { runScheduler };
