import { useAdminStore } from './adminStore';

export function AlertFeed() {
  const { activeAlerts, dismissAlert, clearAll } = useAdminStore();

  const severityColor = {
    HIGH: 'bg-red-100 border-red-500 text-red-800',
    MEDIUM: 'bg-yellow-100 border-yellow-500 text-yellow-800',
    LOW: 'bg-blue-100 border-blue-500 text-blue-800',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Live Alerts ({activeAlerts.length})</h2>
        {activeAlerts.length > 0 && (
          <button onClick={clearAll} className="text-sm text-gray-500 hover:text-gray-700">
            Clear all
          </button>
        )}
      </div>

      {activeAlerts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">✓</p>
          <p>No active alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAlerts.map(alert => (
            <div
              key={alert.alert_id}
              className={`border-l-4 rounded p-4 shadow ${severityColor[alert.severity] || severityColor.LOW}`}
            >
              <div className="flex justify-between">
                <span className="font-bold text-sm uppercase">{alert.alert_type}</span>
                <span className="text-xs">{alert.timestamp}</span>
              </div>
              <p className="mt-1">{alert.message}</p>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Driver: {alert.driver_id}</span>
                <button
                  onClick={() => dismissAlert(alert.alert_id)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
