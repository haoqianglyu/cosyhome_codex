export function calculateDewPoint(temperature, relativeHumidity) {
  const temperatureValue = Number(temperature);
  const humidityValue = Number(relativeHumidity);
  if (
    !Number.isFinite(temperatureValue) ||
    !Number.isFinite(humidityValue) ||
    humidityValue <= 0
  ) {
    return "";
  }

  const a = temperatureValue > 0 ? 7.5 : 9.5;
  const b = temperatureValue > 0 ? 237.3 : 265.5;
  const saturationPressure =
    6.11 * Math.pow(10, (a * temperatureValue) / (b + temperatureValue));
  const vaporPressure = (humidityValue / 100) * saturationPressure;
  const dewPoint = b / (a / Math.log10(vaporPressure / 6.11) - 1);
  return Number.isFinite(dewPoint) ? Number(dewPoint.toFixed(1)) : "";
}
