import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clubLogo from '../assets/club-logo.png';
import '../styles/Login.css';

const getDashboardPath = (user) => {
  if (user?.rol === 'ADMIN') return '/admin/dashboard';
  if (user?.rol === 'ENTRENADOR') return '/entrenador/dashboard';
  if (user?.rol === 'DELEGADO') return '/delegado/dashboard';
  return '/';
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(username, password);
      navigate(getDashboardPath(data.user), { replace: true });
    } catch (err) {
      setError('Error en las credenciales. Intente nuevamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-backdrop" aria-hidden="true" />

      <section className="login-box" aria-label="Ingreso al sistema">
        <div className="login-header">
          <img src={clubLogo} alt="Ayacucho Club de Voleibol" className="login-logo" />
          <div>
            <span className="login-kicker">Sistema oficial</span>
            <h1>Ayacucho Club de Voleibol</h1>
            <p>Gestion de campeonatos, equipos y resultados</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-title">
            <h2>Iniciar sesion</h2>
            <p>Ingresa con tu cuenta para continuar al panel correspondiente.</p>
          </div>

          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              placeholder="Ingrese su usuario"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contrasena</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingrese su contrasena"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                title={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                disabled={loading}
              >
                {showPassword ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
                    <path d="M7.4 7.6C5.7 8.6 4.2 10.1 3 12c2.4 3.7 5.4 5.5 9 5.5 1.4 0 2.7-.3 3.9-.8" />
                    <path d="M10.2 6.7c.6-.1 1.2-.2 1.8-.2 3.6 0 6.6 1.8 9 5.5-.6.9-1.2 1.7-1.9 2.4" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M3 12c2.4-3.7 5.4-5.5 9-5.5s6.6 1.8 9 5.5c-2.4 3.7-5.4 5.5-9 5.5S5.4 15.7 3 12Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className={loading ? 'loading' : ''}>
            {loading ? 'Iniciando sesion...' : 'Iniciar sesion'}
          </button>
        </form>
      </section>
    </div>
  );
}
