import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DelegadoDashboard from './components/DelegadoDashboard';
import EntrenadorDashboard from './components/EntrenadorDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const getDashboardPath = (user) => {
  if (user?.rol === 'ADMIN') return '/admin/dashboard';
  if (user?.rol === 'ENTRENADOR') return '/entrenador/dashboard';
  if (user?.rol === 'DELEGADO') return '/delegado/dashboard';
  return '/';
};

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(user?.rol)) {
    return <Navigate to={getDashboardPath(user)} replace />;
  }

  return children;
}

function AppRoutes() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to={getDashboardPath(user)} replace /> : <Login />}
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entrenador/dashboard"
        element={
          <ProtectedRoute roles={['ENTRENADOR']}>
            <EntrenadorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/delegado/dashboard"
        element={
          <ProtectedRoute roles={['DELEGADO']}>
            <DelegadoDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? getDashboardPath(user) : '/'} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
