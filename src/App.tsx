// src/App.tsx — VoxMeet
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Component, ReactNode } from 'react';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';

// ErrorBoundary — evita tela preta por erros de extensões do browser
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#050505', color: 'white',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '2rem', textAlign: 'center', gap: '1rem'
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Algo deu errado</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', maxWidth: '400px' }}>
            Isso pode ser causado por uma extensão do browser. Tente abrir em uma aba anônima ou desative extensões como o Google Tradutor.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem', padding: '0.75rem 2rem',
              background: 'white', color: 'black', border: 'none',
              borderRadius: '12px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem'
            }}
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<Dashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
          {/* Rota do callback Firebase Auth — deixa o Firebase processar */}
          <Route path="/__/auth/handler" element={<div />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
