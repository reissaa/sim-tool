export interface ClimateData {
  monthlyAvgTemp: number[];
  monthlyTempAmplitude: number[];
  monthlySolarSouth: number[];
  monthlySolarHoriz: number[];
  HDD: number;
  CDD: number;
  prevailingWind: string;
  avgWindSpeed: number;
  humidity: number[];
}

export interface RegionalRecommendations {
  UA: number;
  southWindowRatioMin: number;
  southWindowRatioMax: number;
  thermalMassLevel: 'low' | 'medium' | 'high';
  naturalVentilationMonths: number[];
  shadingRequired: boolean;
  zehUA: number;
}

export interface Region {
  id: string;
  name: string;
  prefecture: string;
  zone: number;
  latitude: number;
  longitude: number;
  climate: ClimateData;
  recommendations: RegionalRecommendations;
  passiveStrategies: string[];
}

export interface BuildingParams {
  floorArea: number;
  height: number;
  widthDepthRatio: number;
  orientation: number;
  wallUValue: number;
  roofUValue: number;
  floorUValue: number;
  southWindowRatio: number;
  northWindowRatio: number;
  eastWindowRatio: number;
  westWindowRatio: number;
  windowUValue: number;
  SHGC: number;
  thermalMass: number;
  ACH: number;
  occupants: number;
  overhanRatio: number;
}

export interface HourlyData {
  hour: number;
  T_outside: number;
  T_room: number;
  T_room_ref: number;
  Q_solar: number;
  Q_heating: number;
  Q_cooling: number;
  Q_conduction: number;
  Q_ventilation: number;
}

export interface SimulationResult {
  hourly: HourlyData[];
  peakCoolingLoad: number;
  peakHeatingLoad: number;
  dailyCoolingEnergy: number;
  dailyHeatingEnergy: number;
  dailyCoolingEnergy_ref: number;
  dailyHeatingEnergy_ref: number;
  indoorMin: number;
  indoorMax: number;
  thermalLag: number;
  comfortHours: number;
  thermalTimeConstant: number;
}

export interface PassiveScores {
  solarUtilization: number;
  insulation: number;
  thermalMass: number;
  naturalVentilation: number;
  shading: number;
  overall: number;
}
