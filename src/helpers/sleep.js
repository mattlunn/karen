export default function sleep(msOrDate) {
  const ms = msOrDate instanceof Date ? msOrDate - Date.now() : msOrDate;

  return new Promise((res) => {
    setTimeout(res, ms);
  });
}