import { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import TaskSubmission from './pages/TaskSubmission';
import TaskHistory from './pages/TaskHistory';
import PendingApprovals from './pages/PendingApprovals';
import Shops from './pages/Shops';
import Agents from './pages/Agents';

interface PlatformCtx {
  platform: string;
  setPlatform: (id: string) => void;
}

export const PlatformContext = createContext<PlatformCtx>({
  platform: 'all',
  setPlatform: () => {},
});

export function usePlatform() {
  return useContext(PlatformContext);
}

export default function App() {
  const [platform, setPlatform] = useState('all');

  return (
    <PlatformContext.Provider value={{ platform, setPlatform }}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/submit" element={<TaskSubmission />} />
            <Route path="/history" element={<TaskHistory />} />
            <Route path="/approvals" element={<PendingApprovals />} />
            <Route path="/shops" element={<Shops />} />
            <Route path="/agents" element={<Agents />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </PlatformContext.Provider>
  );
}
