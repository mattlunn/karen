import { Device } from '../../../models';
import expressAsyncWrapper from '../../../helpers/express-async-wrapper';
import dayjs from '../../../dayjs';
import { getHistoryFetcher } from './history-registry';

// Import definitions to register all fetchers
import './history-definitions';

export default expressAsyncWrapper(async function (req, res, next) {
  const graphId = req.query.id as string | undefined;

  if (!graphId) {
    return res.status(400).json({ error: 'Missing required query parameter: id' });
  }

  const fetcher = getHistoryFetcher(graphId);

  if (!fetcher) {
    return res.status(400).json({ error: `Unknown graph id: ${graphId}` });
  }

  const device = await Device.findById(req.params.id);

  if (!device) {
    return next('route');
  }

  const sinceParam = req.query.since as string | undefined;
  const untilParam = req.query.until as string | undefined;

  const historySelector = {
    since: sinceParam ? new Date(sinceParam) : dayjs().startOf('day').toDate(),
    until: untilParam ? new Date(untilParam) : new Date()
  };

  const response = await fetcher(device, historySelector);
  res.json(response);
});
