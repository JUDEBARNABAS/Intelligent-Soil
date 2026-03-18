import { SensorConfig } from './types';

export const SENSOR_CONFIGS: SensorConfig[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    icon: 'Thermometer',
    color: 'bg-orange-50 text-orange-600 border-orange-100',
  },
  {
    key: 'humidity',
    label: 'Humidity',
    unit: '%RH',
    icon: 'Droplets',
    color: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    key: 'conductivity',
    label: 'Conductivity',
    unit: 'us/cm',
    icon: 'Zap',
    color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  },
  {
    key: 'ph',
    label: 'PH Value',
    unit: 'PH',
    icon: 'Beaker',
    color: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  },
  {
    key: 'nitrogen',
    label: 'Nitrogen',
    unit: 'mg/kg',
    icon: 'Leaf',
    color: 'bg-green-50 text-green-600 border-green-100',
  },
  {
    key: 'phosphorus',
    label: 'Phosphorus',
    unit: 'mg/kg',
    icon: 'Flame',
    color: 'bg-red-50 text-red-600 border-red-100',
  },
  {
    key: 'potassium',
    label: 'Kalium',
    unit: 'mg/kg',
    icon: 'Activity',
    color: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    key: 'fertility',
    label: 'Fertility',
    unit: 'mg/kg',
    icon: 'Sprout',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
];
