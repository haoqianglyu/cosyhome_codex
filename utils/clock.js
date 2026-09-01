const DEFAULT_TIME = "00:00";

function normalizeTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""))
    ? String(value)
    : DEFAULT_TIME;
}

export function normalizeClockInfo(value) {
  const source = value && typeof value === "object" ? value : {};
  const sourceModes = Array.isArray(source.timingMode)
    ? source.timingMode
    : [];
  const timingMode = Array.from({ length: 4 }, (_, index) => {
    const period = Array.isArray(sourceModes[index])
      ? sourceModes[index]
      : [];
    return [normalizeTime(period[0]), normalizeTime(period[1])];
  });
  const currentMode = Math.min(
    Math.max(Number(source.currentMode) || 0, 0),
    timingMode.length - 1,
  );

  return {
    ...source,
    isTiming: Boolean(source.isTiming),
    currentMode,
    timeMode: Number(source.timeMode) === 1 ? 1 : 0,
    timingMode,
  };
}
