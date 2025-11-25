export default function (cb, interval) {
  cb();

  if (isNaN(interval)) {
    throw new Error('Interval must be a number');
  }

  return setInterval(cb, interval);
}