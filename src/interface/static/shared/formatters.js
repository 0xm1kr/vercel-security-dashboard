export const formatDateTime = (millis) => {
  if (millis === null || millis === undefined) return "—";
  return new Date(millis).toLocaleString();
};

export const formatRelative = (millis) => {
  if (millis === null || millis === undefined) return "never";
  const diff = Date.now() - millis;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
};
