import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { client } from './lib/apollo.jsx';
import './i18n';

import HomePage from './pages/HomePage';

const Loading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  return (
    <ApolloProvider client={client}>
      <Router>
        <Suspense fallback={<Loading />}>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/:lang" element={<HomePage />} />
            </Routes>
          </div>
        </Suspense>
      </Router>
    </ApolloProvider>
  );
}

export default App;
