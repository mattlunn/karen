import { Device } from '../../../models';
import expressAsyncWrapper from '../../../helpers/express-async-wrapper';
import dayjs from '../../../dayjs';
import { getHistoryFetcher, hasHistoryFetcher } from './history-registry';

// Import definitions to register all fetchers
import './history-definitions';

export default expressAsyncWrapper(async function (req, res, next) {
  const deviceId = req.params.id;
  const graphId = req.query.id as string | undefined;
  const sinceParam = req.query.since as string | undefined;
  const untilParam = req.query.until as string | undefined;

  if (!graphId) {
    return res.status(400).json({ error: 'Missing required query parameter: id' });
  }

  if (!hasHistoryFetcher(graphId)) {
    return res.status(400).json({ error: `Unknown graph id: ${graphId}` });
  }

  const device = await Device.findById(deviceId);

  if (!device) {
    return next('route');
  }

  const historySelector = {
    since: sinceParam ? new Date(sinceParam) : dayjs().startOf('day').toDate(),
    until: untilParam ? new Date(untilParam) : new Date()
  };

  // Validate dates
  if (isNaN(historySelector.since.getTime()) || isNaN(historySelector.until.getTime())) {
    return res.status(400).json({ error: 'Invalid date format. Use ISO 8601.' });
  }

  if (historySelector.since > historySelector.until) {
    return res.status(400).json({ error: 'since must be before until' });
  }

  const fetcher = getHistoryFetcher(graphId);

  if (!fetcher) {
    return res.status(400).json({ error: `Unknown graph id: ${graphId}` });
  }

  try {
    const response = await fetcher(device, historySelector);
    res.json(response);
  } catch (err) {
    // Capability might not exist on device
    if (err instanceof Error && err.message.includes('capability')) {
      return res.status(400).json({ error: `Device does not have required capability for graph: ${graphId}` });
    }
    throw err;
  }
});
