import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clubLogo from '../assets/club-logo.png';
import { GERENTE_CELULAR, GERENTE_WHATSAPP } from '../config/escuela';
import '../styles/InicioSistema.css';

export default function InicioSistema() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const esAdmin = user?.rol === 'ADMIN';
  const rutaTorneos = user?.rol === 'ADMIN' ? '/admin/dashboard' : '/entrenador/dashboard';

  const salir = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="system-home">
      <header className="system-home-header">
        <div className="system-home-bar">
          <div className="brand-lockup">
            <img src={clubLogo} alt="Ayacucho Club de Voleibol" className="club-logo" />
            <div>
              <h1>AYACUCHO CLUB DE VOLEIBOL</h1>
              <p>Panel principal</p>
            </div>
          </div>
          <div className="system-user">
            <div>
              <strong>{user?.first_name || user?.username}</strong>
              <span>{user?.rol === 'ADMIN' ? 'Administrador' : 'Entrenador'}</span>
            </div>
            <button type="button" onClick={salir}>Cerrar sesion</button>
          </div>
        </div>
      </header>

      <main className="system-home-content">
        <section className="system-heading">
          <p className="system-eyebrow">MODULOS DEL SISTEMA</p>
          <h2>Selecciona el area de trabajo</h2>
          <p>Cada modulo conserva sus propios registros, procesos y reportes.</p>
        </section>

        <section className="module-grid" aria-label="Modulos disponibles">
          <article className="module-tile tournament-module">
            <div className="module-tile-top">
              <span className="module-code">TV</span>
              <span className="module-status">Disponible</span>
            </div>
            <div>
              <h3>Torneos de voleibol</h3>
              <p>Campeonatos, equipos, jugadores, fixture, resultados, posiciones y credenciales.</p>
            </div>
            <ul>
              <li>Gestion competitiva</li>
              <li>Partidos y tablas</li>
              <li>Inscripciones de equipos</li>
            </ul>
            <button type="button" onClick={() => navigate(rutaTorneos)}>Ingresar a Torneos</button>
          </article>

          {esAdmin && (
            <article className="module-tile school-module">
              <div className="module-tile-top">
                <span className="module-code">EV</span>
                <span className="module-status">Disponible</span>
              </div>
              <div>
                <h3>Escuela de voleibol</h3>
                <p>Alumnos, categorias, grupos, mensualidades, mensajes, evaluaciones e inventario.</p>
              </div>
              <ul>
                <li>Gestion academica</li>
                <li>Cobranza y reportes</li>
                <li>WhatsApp web o aplicacion</li>
              </ul>
              <button type="button" onClick={() => navigate('/escuela/dashboard')}>Ingresar a Escuela</button>
            </article>
          )}
        </section>

        {esAdmin && (
          <section className="system-shortcuts">
            <div>
              <span>Inscripcion publica</span>
              <strong>Formulario para nuevos alumnos</strong>
            </div>
            <button type="button" onClick={() => navigate('/escuela/inscripcion')}>Abrir formulario</button>
            <a href={`https://wa.me/${GERENTE_WHATSAPP}`} target="_blank" rel="noreferrer">
              WhatsApp gerente {GERENTE_CELULAR}
            </a>
          </section>
        )}
      </main>
    </div>
  );
}
