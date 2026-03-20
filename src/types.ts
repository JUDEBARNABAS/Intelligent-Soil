export interface Farmer {
  id?: string;
  name: string;
  phone: string;
  email: string;
  farmName: string;
  farmLocation?: string;
  uid: string;
  createdAt: number;
}

export interface SoilData {
  temperature: number;
  humidity: number;
  conductivity: number;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  fertility: number;
  timestamp: number;
  uid?: string;
  farmerId?: string;
  farmerName?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export type UgandanLanguage = 'en' | 'lug' | 'nyn' | 'ach' | 'teo' | 'lgg';

export const UGANDAN_LANGUAGES: { code: UgandanLanguage; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'lug', name: 'Luganda' },
  { code: 'nyn', name: 'Runyankore' },
  { code: 'ach', name: 'Acholi' },
  { code: 'teo', name: 'Ateso' },
  { code: 'lgg', name: 'Lugbara' },
];

export interface ForecastData {
  yieldForecast: string;
  weatherForecast: string;
  agroecologicalRecommendations: string;
  skyTruthSource: string[];
  timestamp: number;
}

export type SensorKey = keyof Omit<SoilData, 'timestamp' | 'location' | 'farmerId' | 'farmerName' | 'uid'>;

export interface SensorConfig {
  key: SensorKey;
  label: string;
  unit: string;
  icon: string;
  color: string;
}

export interface NGODashboardData {
  totalFarmers: number;
  totalTests: number;
  recentTests: SoilData[];
  farmers: (Farmer & { latestTest: SoilData | null })[];
}
