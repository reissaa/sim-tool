import { BuildingParams, Region, HourlyData, SimulationResult } from '../types';

const DT = 0.25; // hours (15-min step)
const RHO_CP_AIR = 1200; // J/(m³·K) = 1.2 kg/m³ × 1000 J/(kg·K)
const COMFORT_MIN = 18;
const COMFORT_MAX = 28;

function outsideTemp(hour: number, avgTemp: number, amplitude: number): number {
  // Peak at 14:00, trough at 5:00 → phase offset ≈ 14h
  return avgTemp + amplitude * Math.sin((2 * Math.PI * (hour - 5)) / 24);
}

function solarIrradiance(
  hour: number,
  peakSolar: number,
  latitude: number,
  month: number,
  face: 'south' | 'east' | 'west' | 'horizontal'
): number {
  const declination = 23.45 * Math.sin((2 * Math.PI * ((month - 1) * 30.5 - 81)) / 365);
  const latRad = (latitude * Math.PI) / 180;
  const decRad = (declination * Math.PI) / 180;
  const cosOmegaS = -Math.tan(latRad) * Math.tan(decRad);
  const omegaS = Math.acos(Math.max(-1, Math.min(1, cosOmegaS))) * (180 / Math.PI);
  const sunrise = 12 - omegaS / 15;
  const sunset = 12 + omegaS / 15;

  if (hour < sunrise || hour > sunset) return 0;

  const hourAngle = ((hour - 12) * 15 * Math.PI) / 180;
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngle);
  const solarAlt = Math.asin(Math.max(0, sinAlt));

  const cosAzimuth =
    (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(solarAlt));
  const azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth)));
  const solarAzimuthFromSouth = hour < 12 ? -azimuth : azimuth;

  const normalFactor = peakSolar * 1.4;
  const horizontal = normalFactor * Math.sin(solarAlt);

  if (face === 'horizontal') return Math.max(0, horizontal);

  const incAngle = (() => {
    switch (face) {
      case 'south': return Math.cos(solarAlt) * Math.cos(solarAzimuthFromSouth);
      case 'east': return Math.cos(solarAlt) * Math.sin(-solarAzimuthFromSouth + Math.PI / 2);
      case 'west': return Math.cos(solarAlt) * Math.sin(solarAzimuthFromSouth + Math.PI / 2);
      default: return 0;
    }
  })();

  return Math.max(0, normalFactor * incAngle);
}

function calcEnvelopeUA(params: BuildingParams): number {
  const depth = Math.sqrt(params.floorArea / params.widthDepthRatio);
  const width = params.widthDepthRatio * depth;
  const wallAreaGross = 2 * (width + depth) * params.height;

  const totalWindowRatio = params.southWindowRatio + params.northWindowRatio + params.eastWindowRatio + params.westWindowRatio;
  const windowArea = totalWindowRatio * params.floorArea;
  const wallArea = wallAreaGross - windowArea;

  return (
    wallArea * params.wallUValue +
    params.floorArea * params.roofUValue +
    params.floorArea * params.floorUValue +
    windowArea * params.windowUValue
  );
}

function calcThermalMassJ(params: BuildingParams): number {
  return params.thermalMass * 1000 * params.floorArea;
}

export function runSimulation(params: BuildingParams, region: Region, month: number): SimulationResult {
  const avgTemp = region.climate.monthlyAvgTemp[month];
  const amplitude = region.climate.monthlyTempAmplitude[month] / 2;
  const peakSolar = region.climate.monthlySolarSouth[month];
  const volume = params.floorArea * params.height * 1.5;

  const UA = calcEnvelopeUA(params);
  const C = calcThermalMassJ(params);
  const tau = C / UA / 3600;

  const southWindowArea = params.southWindowRatio * params.floorArea;
  const eastWindowArea = params.eastWindowRatio * params.floorArea;
  const westWindowArea = params.westWindowRatio * params.floorArea;

  const refUA = params.floorArea * 2.0;
  const refC = 30000 * params.floorArea;

  const steps = Math.round(24 / DT);
  const hourlyMap: Record<number, HourlyData> = {};

  let T_room = avgTemp;
  let T_room_ref = avgTemp;

  for (let pass = 0; pass < 5; pass++) {
    T_room = avgTemp;
    T_room_ref = avgTemp;

    for (let i = 0; i < steps; i++) {
      const hour = i * DT;
      const T_out = outsideTemp(hour, avgTemp, amplitude);

      const I_south = solarIrradiance(hour, peakSolar, region.latitude, month, 'south');
      const I_east = solarIrradiance(hour, peakSolar * 0.7, region.latitude, month, 'east');
      const I_west = solarIrradiance(hour, peakSolar * 0.7, region.latitude, month, 'west');

      const shadingFactor = region.recommendations.shadingRequired
        ? Math.max(0.3, 1 - params.overhanRatio * 1.5)
        : 1.0;

      const Q_solar =
        params.SHGC * (southWindowArea * I_south * shadingFactor + eastWindowArea * I_east + westWindowArea * I_west);
      const Q_cond = UA * (T_out - T_room);
      const Q_vent = (params.ACH * volume * RHO_CP_AIR) / 3600 * (T_out - T_room);
      const Q_internal = params.occupants * 80 + 300;
      const Q_total = Q_cond + Q_solar + Q_vent + Q_internal;

      const Q_cond_ref = refUA * (T_out - T_room_ref);
      const Q_vent_ref = (params.ACH * 1.5 * volume * RHO_CP_AIR) / 3600 * (T_out - T_room_ref);
      const Q_solar_ref = 0.6 * southWindowArea * I_south * 0.3;
      const Q_total_ref = Q_cond_ref + Q_solar_ref + Q_vent_ref + Q_internal;

      T_room += (Q_total / C) * DT * 3600;
      T_room_ref += (Q_total_ref / refC) * DT * 3600;

      if (pass === 4) {
        const h = Math.round(hour * 10) / 10;
        hourlyMap[h] = {
          hour: h,
          T_outside: T_out,
          T_room,
          T_room_ref,
          Q_solar,
          Q_heating: Math.max(0, -Q_total),
          Q_cooling: Math.max(0, Q_total),
          Q_conduction: Q_cond,
          Q_ventilation: Q_vent,
        };
      }
    }
  }

  const hourly = Object.values(hourlyMap).sort((a, b) => a.hour - b.hour);

  const temps = hourly.map((h) => h.T_room);
  const indoorMin = Math.min(...temps);
  const indoorMax = Math.max(...temps);

  const outsideTemps = hourly.map((h) => h.T_outside);
  const outsidePeakHour = outsideTemps.indexOf(Math.max(...outsideTemps)) * DT;
  const roomPeakHour = temps.indexOf(Math.max(...temps)) * DT;
  const thermalLag = ((roomPeakHour - outsidePeakHour + 24) % 24);

  const comfortHours = hourly.filter((h) => h.T_room >= COMFORT_MIN && h.T_room <= COMFORT_MAX).length * DT;

  let dailyCoolingEnergy = 0;
  let dailyHeatingEnergy = 0;
  let dailyCoolingEnergy_ref = 0;
  let dailyHeatingEnergy_ref = 0;

  const coolingTarget = 26;
  const heatingTarget = 20;

  for (const h of hourly) {
    if (h.T_room > coolingTarget) dailyCoolingEnergy += (h.T_room - coolingTarget) * UA * DT;
    if (h.T_room < heatingTarget) dailyHeatingEnergy += (heatingTarget - h.T_room) * UA * DT;
    if (h.T_room_ref > coolingTarget) dailyCoolingEnergy_ref += (h.T_room_ref - coolingTarget) * refUA * DT;
    if (h.T_room_ref < heatingTarget) dailyHeatingEnergy_ref += (heatingTarget - h.T_room_ref) * refUA * DT;
  }

  const peakCoolingLoad = Math.max(...hourly.map((h) => Math.max(0, (h.T_room - coolingTarget) * UA)));
  const peakHeatingLoad = Math.max(...hourly.map((h) => Math.max(0, (heatingTarget - h.T_room) * UA)));

  return {
    hourly,
    peakCoolingLoad,
    peakHeatingLoad,
    dailyCoolingEnergy: dailyCoolingEnergy / 3600000,
    dailyHeatingEnergy: dailyHeatingEnergy / 3600000,
    dailyCoolingEnergy_ref: dailyCoolingEnergy_ref / 3600000,
    dailyHeatingEnergy_ref: dailyHeatingEnergy_ref / 3600000,
    indoorMin,
    indoorMax,
    thermalLag,
    comfortHours,
    thermalTimeConstant: tau,
  };
}

export function calcPassiveScores(params: BuildingParams, region: Region, month: number) {
  const rec = region.recommendations;
  const UA = calcEnvelopeUA(params);
  const UAref = params.floorArea * 0.87;

  const targetSouthRatio = (rec.southWindowRatioMin + rec.southWindowRatioMax) / 2;
  const solarScore = Math.max(
    0,
    100 - Math.abs(params.southWindowRatio - targetSouthRatio) / targetSouthRatio * 100
  );

  const insulationScore = Math.min(100, Math.max(0, (1 - UA / (UAref * 1.5)) * 100 + 30));

  const targetMass = rec.thermalMassLevel === 'high' ? 150 : rec.thermalMassLevel === 'medium' ? 100 : 60;
  const massScore = Math.min(100, (params.thermalMass / targetMass) * 100);

  const openingRatio = params.southWindowRatio + params.northWindowRatio + params.eastWindowRatio + params.westWindowRatio;
  const ventScore = Math.min(100, openingRatio * 500);

  const shadingScore = rec.shadingRequired
    ? Math.min(100, params.overhanRatio * 200)
    : Math.max(0, 100 - params.overhanRatio * 100);

  const overall = (solarScore * 0.25 + insulationScore * 0.30 + massScore * 0.20 + ventScore * 0.15 + shadingScore * 0.10);

  return {
    solarUtilization: Math.round(solarScore),
    insulation: Math.round(insulationScore),
    thermalMass: Math.round(massScore),
    naturalVentilation: Math.round(ventScore),
    shading: Math.round(shadingScore),
    overall: Math.round(overall),
  };
}

export function calcUA(params: BuildingParams): number {
  return calcEnvelopeUA(params) / params.floorArea;
}
