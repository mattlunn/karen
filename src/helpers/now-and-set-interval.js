export default function (cb, interval) {
  cb();

  return setInterval(cb, interval);
}