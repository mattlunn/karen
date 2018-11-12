import express from 'express';
import asyncWrapper from '../helpers/express-async-wrapper';
import { Event, Recording } from '../models';
import moment from 'moment';
import s3 from '../services/s3';

const router = express.Router();

router.get('/:id', asyncWrapper(async function (req, res) {
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
    res.set('Content-disposition', 'attachment; filename=' + moment(recording.event.timestamp).format('YYYY-MM-DD HH:mm:ss') + '.mp4');
  }

  res.writeHead(status, {
    'Accept-Ranges': 'bytes',
    'Content-Type': 'video/mp4',
    'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + recording.size,
    'Content-Length': chunk + 1
  })

  return s3.serve(recording.recording, range.start, range.end).then((file) => {
    res.end(file);
  });
}));

export default router;