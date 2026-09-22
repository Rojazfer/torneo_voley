// Configuración base de la API
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_URL = `${API_BASE_URL.replace(/\/$/, '')}/api`;

export const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL.replace(/\/$/, '')}${url}`;
  return url;
};

// Obtener token del localStorage
const getToken = () => {
  return localStorage.getItem('access_token');
};

// Guardar tokens
const saveTokens = (access, refresh) => {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
};

// Limpiar tokens
const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// Login
export const login = async (username, password) => {
  try {
    const response = await fetch(`${API_URL}/auth/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error('Credenciales inválidas');
    }

    const data = await response.json();
    saveTokens(data.access, data.refresh);
    return data;
  } catch (error) {
    console.error('Error en login:', error);
    throw error;
  }
};

// Obtener información del usuario autenticado
export const getMe = async () => {
  try {
    const token = getToken();
    const response = await fetch(`${API_URL}/auth/me/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('No autorizado');
    }

    return await response.json();
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    throw error;
  }
};

// Obtener estadísticas del dashboard
export const getDashboardStats = async () => {
  try {
    const token = getToken();
    const response = await fetch(`${API_URL}/dashboard/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('No autorizado');
    }

    return await response.json();
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    throw error;
  }
};

const request = async (endpoint, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const token = getToken();
  const headers = {
    ...(isFormData ? (token ? { 'Authorization': `Bearer ${token}` } : {}) : getAuthHeaders()),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Error en la solicitud');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const getTorneos = () => request('/torneos/');
export const createTorneo = (data) => request('/torneos/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateTorneo = (id, data) => request(`/torneos/${id}/`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});
export const deleteTorneo = (id) => request(`/torneos/${id}/`, {
  method: 'DELETE',
});

export const getEquipos = () => request('/equipos/');
export const createEquipo = (data) => request('/equipos/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateEquipo = (id, data) => request(`/equipos/${id}/`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});
export const deleteEquipo = (id) => request(`/equipos/${id}/`, {
  method: 'DELETE',
});

export const getJugadores = () => request('/jugadores/');
export const createJugador = (data) => {
  if (data.foto instanceof File) {
    return request('/jugadores/', {
      method: 'POST',
      body: toFormData(data),
    });
  }

  return request('/jugadores/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
export const updateJugador = (id, data) => request(`/jugadores/${id}/`, {
  method: 'PATCH',
  body: data.foto instanceof File ? toFormData(data) : JSON.stringify(data),
});
export const deleteJugador = (id) => request(`/jugadores/${id}/`, {
  method: 'DELETE',
});

export const getCredenciales = () => request('/credenciales/');
export const createCredencial = (data) => request('/credenciales/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const deleteCredencial = (id) => request(`/credenciales/${id}/`, {
  method: 'DELETE',
});

export const getPartidos = () => request('/partidos/');
export const updatePartido = (id, data) => request(`/partidos/${id}/`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});
export const deletePartido = (id) => request(`/partidos/${id}/`, {
  method: 'DELETE',
});
export const generarFixture = (data) => request('/fixture/generar/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const registrarResultado = (partidoId, data) => request(`/partidos/${partidoId}/resultado/`, {
  method: 'POST',
  body: JSON.stringify(data),
});
export const getPosiciones = () => request('/posiciones/');

export const getUsuarios = () => request('/usuarios/');
export const createUsuario = (data) => request('/usuarios/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateUsuario = (id, data) => request(`/usuarios/${id}/`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});
export const deleteUsuario = (id) => request(`/usuarios/${id}/`, {
  method: 'DELETE',
});

export const getResumenEscuela = () => request('/escuela/resumen/');
export const getCategoriasEscuela = () => request('/escuela/categorias/');
export const createCategoriaEscuela = (data) => request('/escuela/categorias/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateCategoriaEscuela = (id, data) => request(`/escuela/categorias/${id}/`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});
export const deleteCategoriaEscuela = (id) => request(`/escuela/categorias/${id}/`, { method: 'DELETE' });

export const getAlumnosEscuela = () => request('/escuela/alumnos/');
export const createAlumnoEscuela = (data) => request('/escuela/alumnos/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateAlumnoEscuela = (id, data) => request(`/escuela/alumnos/${id}/`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});
export const deleteAlumnoEscuela = (id) => request(`/escuela/alumnos/${id}/`, { method: 'DELETE' });

export const getMensualidadesEscuela = () => request('/escuela/mensualidades/');
export const generarMensualidadesEscuela = (data) => request('/escuela/mensualidades/generar/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateMensualidadEscuela = (id, data) => request(`/escuela/mensualidades/${id}/`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});
export const createPagoEscuela = (data) => request('/escuela/pagos/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const deletePagoEscuela = (id) => request(`/escuela/pagos/${id}/`, { method: 'DELETE' });

export const getPlantillasEscuela = () => request('/escuela/plantillas/');
export const createPlantillaEscuela = (data) => request('/escuela/plantillas/', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updatePlantillaEscuela = (id, data) => request(`/escuela/plantillas/${id}/`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});
export const deletePlantillaEscuela = (id) => request(`/escuela/plantillas/${id}/`, { method: 'DELETE' });
export const registrarMensajeEscuela = (data) => request('/escuela/mensajes/', {
  method: 'POST',
  body: JSON.stringify(data),
});

const escuelaCrud = (ruta) => ({
  list: () => request(`/escuela/${ruta}/`),
  create: (data) => request(`/escuela/${ruta}/`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/escuela/${ruta}/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id) => request(`/escuela/${ruta}/${id}/`, { method: 'DELETE' }),
});

export const gruposEscuela = escuelaCrud('grupos');
export const entrenadoresEscuela = escuelaCrud('entrenadores');
export const cambiosHorarioEscuela = escuelaCrud('cambios-horario');
export const descuentosEscuela = escuelaCrud('descuentos');
export const evaluacionesEscuela = escuelaCrud('evaluaciones');
export const fichasMedicasEscuela = escuelaCrud('fichas-medicas');
export const uniformesEscuela = escuelaCrud('uniformes');
export const materialesEscuela = escuelaCrud('materiales');
export const getReportesEscuela = () => request('/escuela/reportes/');
export const getDocumentosEscuela = () => request('/escuela/documentos/');
export const createDocumentoEscuela = (data) => request('/escuela/documentos/', {
  method: 'POST',
  body: toFormData(data),
});
export const deleteDocumentoEscuela = (id) => request(`/escuela/documentos/${id}/`, { method: 'DELETE' });
export const getCatalogoInscripcion = () => request('/escuela/publico/catalogo/');
export const createSolicitudInscripcion = (data) => request('/escuela/publico/solicitudes/', { method: 'POST', body: JSON.stringify(data) });
export const getSolicitudesInscripcion = () => request('/escuela/solicitudes/');
export const revisarSolicitudInscripcion = (id, data) => request(`/escuela/solicitudes/${id}/revisar/`, { method: 'PATCH', body: JSON.stringify(data) });
export const listaEsperaEscuela = escuelaCrud('lista-espera');
export const gastosEscuela = escuelaCrud('gastos');
export const inventarioEscuela = escuelaCrud('inventario');
export const getMovimientosInventario = () => request('/escuela/inventario-movimientos/');
export const createMovimientoInventario = (data) => request('/escuela/inventario-movimientos/', { method: 'POST', body: JSON.stringify(data) });
export const getAuditoriaEscuela = () => request('/escuela/auditoria/');
export const getPortalTutor = () => request('/escuela/portal-tutor/');

// Logout
export const logout = () => {
  clearTokens();
};

// Obtener los headers con autenticación
export const getAuthHeaders = () => {
  const token = getToken();
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
};

export default {
  login,
  getMe,
  getDashboardStats,
  getTorneos,
  createTorneo,
  updateTorneo,
  deleteTorneo,
  getEquipos,
  createEquipo,
  updateEquipo,
  deleteEquipo,
  getJugadores,
  createJugador,
  updateJugador,
  deleteJugador,
  getCredenciales,
  createCredencial,
  deleteCredencial,
  getPartidos,
  updatePartido,
  deletePartido,
  generarFixture,
  registrarResultado,
  getPosiciones,
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getResumenEscuela,
  getCategoriasEscuela,
  createCategoriaEscuela,
  updateCategoriaEscuela,
  deleteCategoriaEscuela,
  getAlumnosEscuela,
  createAlumnoEscuela,
  updateAlumnoEscuela,
  deleteAlumnoEscuela,
  getMensualidadesEscuela,
  generarMensualidadesEscuela,
  updateMensualidadEscuela,
  createPagoEscuela,
  deletePagoEscuela,
  getPlantillasEscuela,
  createPlantillaEscuela,
  updatePlantillaEscuela,
  deletePlantillaEscuela,
  registrarMensajeEscuela,
  gruposEscuela,
  entrenadoresEscuela,
  cambiosHorarioEscuela,
  descuentosEscuela,
  evaluacionesEscuela,
  fichasMedicasEscuela,
  uniformesEscuela,
  materialesEscuela,
  getReportesEscuela,
  getDocumentosEscuela,
  createDocumentoEscuela,
  deleteDocumentoEscuela,
  getCatalogoInscripcion,
  createSolicitudInscripcion,
  getSolicitudesInscripcion,
  revisarSolicitudInscripcion,
  listaEsperaEscuela,
  gastosEscuela,
  inventarioEscuela,
  getMovimientosInventario,
  createMovimientoInventario,
  getAuditoriaEscuela,
  getPortalTutor,
  logout,
  getToken,
  getAuthHeaders,
  saveTokens,
  clearTokens,
  getMediaUrl,
};

function toFormData(data) {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      formData.append(key, value);
    }
  });

  return formData;
}
