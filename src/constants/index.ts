// App routes, Firestore collection names, and fixed session values used across the app.

/** Texto alternativo del logo / marca en UI. */
export const MARCA_APP = 'Molina'

/** Textos de cabecera del área principal (plantilla). */
export const TEXTO_SUBTITULO_PANEL =
  'Vista general de todo lo relacionado a la gestión del club del adulto mayor en Molina'

export const TEXTO_SUBTITULO_USUARIOS = 'Administración de usuarios de la plataforma.'

export const TEXTO_SUBTITULO_NUEVO_USUARIO =
  'Complete el formulario para crear un nuevo usuario'

export const TEXTO_SUBTITULO_ADMIN_CLUBES =
  'Administra los clubes de adultos mayores de la región.'

export const TEXTO_SUBTITULO_ADMIN_MIEMBROS_CLUBES =
  'Seleccione un club para ver, agregar o importar miembros desde CSV (un club).'

export const TEXTO_SUBTITULO_ADMIN_DIRECTIVAS_CAM =
  'Registre lugar, día y horario de reunión y asigne cargos solo a personas ya dadas de alta como miembros del club.'

/** Rol asignado automáticamente al crear usuario desde el panel (sin selector en UI). */
export const ROL_ALTA_USUARIO_PANEL = 'admin'

/** Placeholder de perfil en barra lateral hasta conectar datos reales desde backend. */
export const PERFIL_PLACEHOLDER_NOMBRE = 'Alex Ruiz'
export const PERFIL_PLACEHOLDER_INICIALES = 'AR'

/** Application paths (avoid magic strings in links and redirects). */
export const ROUTES = {
  home: '/',
  login: '/login',
  forgotPassword: '/forgot-password',
  dashboard: '/dashboard',
  screenTwo: '/screen-two',
  screenThree: '/screen-three',
  adminClubes: '/admin/clubes',
  adminMiembrosClubes: '/admin/miembros-clubes',
  adminMiembrosBusqueda: '/admin/miembros/busqueda',
  adminDirectivas: '/admin/directivas',
} as const

/** Frase exacta que el administrador debe enviar para borrar todos los miembros de todos los clubes. */
export const CONFIRMACION_VACIAR_TODOS_MIEMBROS = 'VACIAR_TODOS_LOS_MIEMBROS'

/** Confirmación para borrar todos los miembros del club seleccionado (no afecta otros clubes). */
export const CONFIRMACION_VACIAR_MIEMBROS_CLUB = 'ELIMINAR_MIEMBROS_DE_ESTE_CLUB'

/** Confirmación para reset masivo tras migración (borra `miembros_club` y pone `miembros: 0` en cada club). */
export const CONFIRMACION_RESET_MIEMBROS_POST_IMPORT = 'RESETEAR_MIEMBROS_IMPORTACION'

/** Firestore collection names (only the server writes via Admin SDK). */
export const COLECCIONES = {
  /** Perfiles de app: colección `users` (campos típicos: email, name, lastName, role, active). */
  usuarios: 'users',
  /** Clubes de adultos mayores (nombre, comuna, region, activo, miembros, …). */
  clubes: 'clubes',
  /** Miembros asociados a un club (clubId, nombre, apellidos, rut). */
  miembrosClub: 'miembros_club',
  /** Totales del panel (1 lectura): doc `panel` con totalClubes, activos, totalMiembros. */
  aggregates: 'aggregates',
  /** Directiva de cada club (1 doc por club con array de miembros embebido). */
  directivasClub: 'directivas_club',
} as const

/** Id del documento de resumen en `aggregates` (totales para dashboard). */
export const AGGREGATES_DOC_PANEL = 'panel'

/** httpOnly cookie name for the verified server session. */
export const NOMBRE_COOKIE_SESION = 'sesion-auth'

/** Session cookie max-age in seconds (5 days). */
export const MAX_AGE_COOKIE_SESION_SEG = 432000

/** Session duration in ms (5 days), for createSessionCookie. */
export const DURACION_SESION_MS = 5 * 24 * 60 * 60 * 1000
