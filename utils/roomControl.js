function isTrueFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function normalizeWindControl(body) {
  const source = body && typeof body === "object" ? body : {};
  const rawLevelCount = source.windLevelNumber;
  const parsedLevelCount = Number(rawLevelCount);
  const hasWindControl =
    rawLevelCount !== undefined &&
    rawLevelCount !== null &&
    rawLevelCount !== "" &&
    Number.isFinite(parsedLevelCount) &&
    parsedLevelCount >= 0;

  if (!hasWindControl) {
    return {
      hasWindControl: false,
      windLevelNumber: null,
      windLevels: [],
      isAutoWindLevel: false,
      currentButton: null,
    };
  }

  const windLevelNumber = Math.min(Math.floor(parsedLevelCount), 10);
  const isAutoWindLevel = isTrueFlag(source.isAutoWindLevel);
  const currentLevel = Number(source.windLevel);
  let currentButton = null;

  if (currentLevel === 100 && isAutoWindLevel) {
    currentButton = 100;
  } else if (
    Number.isInteger(currentLevel) &&
    currentLevel >= 1 &&
    currentLevel <= windLevelNumber
  ) {
    currentButton = currentLevel - 1;
  }

  return {
    hasWindControl: true,
    windLevelNumber,
    windLevels: Array.from({ length: windLevelNumber }, (_, index) => index),
    isAutoWindLevel,
    currentButton,
  };
}
