import { BrowserRouter, Route, Routes } from 'react-router';
import { useRoomSocket } from './hooks/useRoomSocket.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { EventOverlay } from './components/EventOverlay.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { Lobby } from './features/lobby/Lobby.tsx';
import { ResultDemoView } from './features/room/ResultDemoView.tsx';
import { RoomScreen } from './features/room/RoomScreen.tsx';
import { RuleTestPage } from './features/rule-test/RuleTestPage.tsx';

export default function App() {
  useRoomSocket();

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:id" element={<RoomScreen />} />
          <Route path="/result-demo" element={<ResultDemoView />} />
          <Route path="/rule-test" element={<RuleTestPage />} />
        </Routes>
        <EventOverlay />
        <ToastContainer />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
