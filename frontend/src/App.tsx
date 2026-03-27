import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { TrackingPage } from './features/tracking/TrackingPage';
import { DriverPage } from './features/driver/DriverPage';
import { AdminPage } from './features/admin/AdminPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow p-4 mb-4">
          <div className="max-w-4xl mx-auto flex gap-6">
            <Link to="/" className="text-blue-600 font-bold hover:underline">Customer View</Link>
            <Link to="/driver" className="text-blue-600 font-bold hover:underline">Driver View</Link>
            <Link to="/admin" className="text-blue-600 font-bold hover:underline">Admin Dashboard</Link>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<TrackingPage />} />
          <Route path="/driver" element={<DriverPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
