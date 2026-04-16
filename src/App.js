import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Join from './pages/Join';
import Vote from './pages/Vote';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:code" element={<Join />} />
        {/* vote → waiting → result 전환은 Vote 내부 useState로 관리 */}
        <Route path="/vote" element={<Vote />} />
        {/* 직접 /result 접근 시 /vote로 리다이렉트 */}
        <Route path="/result" element={<Navigate to="/vote" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
