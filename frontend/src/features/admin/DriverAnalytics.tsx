import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export function DriverAnalytics() {
  const [selectedDriver, setSelectedDriver] = useState('D001');

  const { data: analytics = [] } = useQuery({
    queryKey: ['drivers', selectedDriver, 'analytics'],
    queryFn: () =>
      fetch(`http://localhost:8080/api/drivers/${selectedDriver}/analytics`).then(r => r.json()).catch(() => []),
  });

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Driver Analytics</h2>

      <select
        value={selectedDriver}
        onChange={(e) => setSelectedDriver(e.target.value)}
        className="border rounded px-3 py-2 mb-4"
      >
        <option value="D001">Driver D001</option>
      </select>

      {analytics.length === 0 ? (
        <p className="text-gray-500">No analytics data available</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {analytics.map((week: {
            week_start_date: string;
            total_trips: number;
            total_distance: number;
            average_speed: number;
            speeding_violations: number;
          }) => (
            <div key={week.week_start_date} className="border rounded p-4 shadow">
              <h3 className="font-bold">{week.week_start_date}</h3>
              <div className="mt-2 space-y-1 text-sm">
                <p>🚗 Total trips: <strong>{week.total_trips}</strong></p>
                <p>📍 Distance: <strong>{week.total_distance?.toFixed(1)} km</strong></p>
                <p>⚡ Avg speed: <strong>{week.average_speed?.toFixed(1)} km/h</strong></p>
                <p>🚨 Speeding violations: <strong className="text-red-600">{week.speeding_violations}</strong></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
