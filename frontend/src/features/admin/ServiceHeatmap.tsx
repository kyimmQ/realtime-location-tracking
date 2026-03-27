import { useQuery } from '@tanstack/react-query';

export function ServiceHeatmap() {
  // Fetch heatmap data (grouped by geohash cells)
  const { data: cells = [] } = useQuery({
    queryKey: ['admin', 'heatmap'],
    queryFn: () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return fetch(`http://localhost:8080/api/admin/heatmap?since=${since}`).then(r => r.json()).catch(() => []);
    },
  });

  // Simple color gradient: gray → yellow → orange → red
  const getColor = (count: number, max: number) => {
    const ratio = count / max;
    if (ratio < 0.33) return '#ffffb2';  // yellow
    if (ratio < 0.66) return '#fecc5c';  // orange
    return '#fd8d3c';                     // red
  };

  const maxCount = Math.max(...cells.map((c: { delivery_count: number }) => c.delivery_count), 1);

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Service Area Heatmap (Last 7 Days)</h2>

      {/* Simple table visualization (for PoC) */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="p-2">Zone</th>
            <th className="p-2">Deliveries</th>
            <th className="p-2">Density</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell: { geohash: string; delivery_count: number }) => (
            <tr key={cell.geohash} className="border-t">
              <td className="p-2 font-mono text-xs">{cell.geohash}</td>
              <td className="p-2">{cell.delivery_count}</td>
              <td className="p-2">
                <div className="w-24 h-4 rounded overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${(cell.delivery_count / maxCount) * 100}%`,
                      backgroundColor: getColor(cell.delivery_count, maxCount),
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
