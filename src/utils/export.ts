import { SoilData } from '../types';
import { SENSOR_CONFIGS } from '../constants';
import { format } from 'date-fns';

export const exportToCSV = (data: SoilData[]) => {
  const headers = [
    'Timestamp',
    'Farmer',
    'Latitude',
    'Longitude',
    ...SENSOR_CONFIGS.map(c => `${c.label} (${c.unit})`)
  ];

  const rows = data.map(item => [
    format(item.timestamp, 'yyyy-MM-dd HH:mm:ss'),
    item.farmerName ?? 'N/A',
    item.location?.latitude ?? '',
    item.location?.longitude ?? '',
    ...SENSOR_CONFIGS.map(c => item[c.key as keyof SoilData] ?? '')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `soil_data_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
