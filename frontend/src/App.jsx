import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DelegadoDashboard from './components/DelegadoDashboard';
import EntrenadorDashboard from './components/EntrenadorDashboard';
import EscuelaDashboard from './components/EscuelaDashboard';
import InscripcionEscuela from './components/InscripcionEscuela';
import TutorDashboard from './components/TutorDashboard';
import InicioSistema from './components/InicioSistema';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const getDashboardPath = (user) => {
  if (user?.rol === 'ADMIN' || user?.rol === 'ENTRENADOR') return '/inicio';
  if (user?.rol === 'DELEGADO') return '/delegado/dashboard';
  if (user?.rol === 'TUTOR') return '/tutor/dashboard';
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
        path="/escuela/inscripcion"
        element={<InscripcionEscuela />}
      />
      <Route
        path="/inicio"
        element={
          <ProtectedRoute roles={['ADMIN', 'ENTRENADOR']}>
            <InicioSistema />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tutor/dashboard"
        element={
          <ProtectedRoute roles={['TUTOR']}>
            <TutorDashboard />
          </ProtectedRoute>
        }
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
      <Route
        path="/escuela/dashboard"
        element={
          <ProtectedRoute roles={['ADMIN', 'ENTRENADOR']}>
            <EscuelaDashboard />
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
