import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Event, Recording } from '../models';
import { makeSynologyRequest } from '../services/synology';
import moment from 'moment';
import s3 from '../services/s3';

const router = express.Router();

router.get('/snapshot/:id', asyncWrapper(async (req, res) => {
  res.type('jpeg').end(await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'GetSnapshot', {
    cameraId: req.params.id
  }, false, 8));
}));

router.get('/event/:id/thumbnail', asyncWrapper(async (req, res) => {
  try {
    const file = await s3.serve(req.params.id);

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(file).end();
  } catch (e) {
    res.sendStatus(404);
  }
}));

router.get('/recording/:id', asyncWrapper(async function (req, res) {
  const recording = await Recording.findOne({
    where: {
      id: req.params.id
    },
    include: [Event]
  });

  if (recording == null)
    throw new Error('route');

  const ranges = req.range(recording.size);
  let status;
  let range;

  if (!Array.isArray(ranges)) {
    res.sendStatus(416);
    return;
  }

  if (ranges && ranges.length === 1) {
    range = ranges[0];
    status = 206;
  } else {
    status = 200;
    range = {
      start: 0,
      end: recording.size - 1
    };
  }

  const chunk = range.end - range.start;

  if (req.query.download === 'true') {
    res.set('Content-disposition', 'attachment; filename=' + moment(recording.event.start).format('YYYY-MM-DD HH:mm:ss') + '.mp4');
  }

  res.writeHead(status, {
    'Accept-Ranges': 'bytes',
    'Content-Type': 'video/mp4',
    'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + recording.size,
    'Content-Length': chunk + 1
  });

  return s3.serve(recording.recording, range.start, range.end).then((file) => {
    res.end(file);
  });
}));

export default router;