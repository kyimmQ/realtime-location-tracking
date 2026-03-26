import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { TrackingPage } from './features/tracking/TrackingPage';
import { DriverPage } from './features/driver/DriverPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow p-4 mb-4">
          <div className="max-w-2xl mx-auto flex justify-between">
            <Link to="/" className="text-blue-600 font-bold hover:underline">Customer View</Link>
            <Link to="/driver" className="text-blue-600 font-bold hover:underline">Driver View</Link>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<TrackingPage />} />
          <Route path="/driver" element={<DriverPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
