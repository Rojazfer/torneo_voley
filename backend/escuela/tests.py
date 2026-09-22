from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import (
    Alumno, CategoriaEscuela, DescuentoAlumno, EntrenadorEscuela, GrupoEntrenamiento, ListaEspera,
    Mensualidad, Pago, ProductoInventario, RegistroAuditoria, SolicitudInscripcion,
)

User = get_user_model()


class EscuelaAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin-escuela', email='admin@escuela.test', password='clave', rol='ADMIN')
        self.entrenador = User.objects.create_user(username='coach-escuela', email='coach@escuela.test', password='clave', rol='ENTRENADOR')
        self.otro_entrenador = User.objects.create_user(username='otro-coach', email='otro@escuela.test', password='clave', rol='ENTRENADOR')
        self.categoria = CategoriaEscuela.objects.create(nombre='Sub 10', edad_minima=8, edad_maxima=10, monto_mensual=Decimal('150.00'), dia_vencimiento=10)
        self.categoria.entrenadores.add(self.entrenador)
        self.alumno = Alumno.objects.create(
            categoria=self.categoria,
            entrenador=self.entrenador,
            nombres='Ana',
            apellidos='Perez',
            documento='AL-001',
            tutor_nombre='Maria Perez',
            tutor_telefono='71234567',
            creado_por=self.admin,
        )

    def test_genera_una_sola_mensualidad_por_periodo(self):
        self.client.force_authenticate(self.admin)
        payload = {'periodo': '2026-09-01', 'categoria': self.categoria.id}
        primera = self.client.post('/api/escuela/mensualidades/generar/', payload, format='json')
        segunda = self.client.post('/api/escuela/mensualidades/generar/', payload, format='json')

        self.assertEqual(primera.status_code, 201)
        self.assertEqual(primera.data['creadas'], 1)
        self.assertEqual(segunda.data['existentes'], 1)
        mensualidad = Mensualidad.objects.get(alumno=self.alumno)
        self.assertEqual(mensualidad.monto, Decimal('150.00'))
        self.assertEqual(mensualidad.fecha_vencimiento, date(2026, 9, 10))

    def test_pagos_parciales_actualizan_estado_y_saldo(self):
        mensualidad = Mensualidad.objects.create(
            alumno=self.alumno,
            periodo=date(2026, 9, 1),
            monto=Decimal('150.00'),
            fecha_vencimiento=date(2026, 9, 10),
            creada_por=self.admin,
        )
        self.client.force_authenticate(self.admin)
        parcial = self.client.post('/api/escuela/pagos/', {'mensualidad': mensualidad.id, 'monto': '50.00', 'fecha_pago': '2026-09-05', 'metodo': 'QR'}, format='json')
        mensualidad.refresh_from_db()
        self.assertEqual(parcial.status_code, 201)
        self.assertEqual(mensualidad.estado, 'PARCIAL')
        self.assertEqual(mensualidad.saldo, Decimal('100.00'))

        completo = self.client.post('/api/escuela/pagos/', {'mensualidad': mensualidad.id, 'monto': '100.00', 'fecha_pago': '2026-09-06', 'metodo': 'EFECTIVO'}, format='json')
        mensualidad.refresh_from_db()
        self.assertEqual(completo.status_code, 201)
        self.assertEqual(mensualidad.estado, 'PAGADA')
        self.assertEqual(mensualidad.saldo, Decimal('0.00'))

    def test_entrenador_no_puede_cobrar_alumno_ajeno(self):
        mensualidad = Mensualidad.objects.create(
            alumno=self.alumno,
            periodo=date(2026, 9, 1),
            monto=Decimal('150.00'),
            fecha_vencimiento=date(2026, 9, 10),
            creada_por=self.admin,
        )
        self.client.force_authenticate(self.otro_entrenador)
        response = self.client.post('/api/escuela/pagos/', {'mensualidad': mensualidad.id, 'monto': '50.00', 'fecha_pago': '2026-09-05', 'metodo': 'EFECTIVO'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_entrenador_solo_ve_sus_alumnos(self):
        otra_categoria = CategoriaEscuela.objects.create(nombre='Sub 14', monto_mensual=Decimal('180.00'))
        Alumno.objects.create(
            categoria=otra_categoria,
            entrenador=self.otro_entrenador,
            nombres='Luisa',
            apellidos='Rojas',
            documento='AL-002',
            tutor_nombre='Jose Rojas',
            tutor_telefono='72345678',
        )
        self.client.force_authenticate(self.entrenador)
        response = self.client.get('/api/escuela/alumnos/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['documento'] for item in response.data], ['AL-001'])

    def test_beca_y_descuento_se_aplican_sin_recargo(self):
        DescuentoAlumno.objects.create(
            alumno=self.alumno,
            nombre='Beca deportiva',
            tipo='PORCENTAJE',
            valor=Decimal('20.00'),
            fecha_inicio=date(2026, 1, 1),
            autorizado_por=self.admin,
        )
        DescuentoAlumno.objects.create(
            alumno=self.alumno,
            nombre='Descuento hermanos',
            tipo='MONTO',
            valor=Decimal('10.00'),
            fecha_inicio=date(2026, 1, 1),
            autorizado_por=self.admin,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/escuela/mensualidades/generar/', {'periodo': '2026-09-01'}, format='json')
        mensualidad = Mensualidad.objects.get(alumno=self.alumno)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(mensualidad.monto_base, Decimal('150.00'))
        self.assertEqual(mensualidad.descuento_aplicado, Decimal('40.00'))
        self.assertEqual(mensualidad.monto, Decimal('110.00'))
        self.assertEqual(mensualidad.saldo, Decimal('110.00'))

    def test_pago_genera_numero_de_recibo(self):
        mensualidad = Mensualidad.objects.create(
            alumno=self.alumno,
            periodo=date(2026, 9, 1),
            monto_base=Decimal('150.00'),
            monto=Decimal('150.00'),
            fecha_vencimiento=date(2026, 9, 10),
            creada_por=self.admin,
        )
        pago = Pago.objects.create(
            mensualidad=mensualidad,
            monto=Decimal('150.00'),
            fecha_pago=date(2026, 9, 5),
            registrado_por=self.admin,
        )
        self.assertEqual(pago.numero_recibo, f'REC-2026-{pago.id:06d}')

    def test_reporte_incluye_finanzas_familias_y_operadores(self):
        mensualidad = Mensualidad.objects.create(
            alumno=self.alumno,
            periodo=date(2026, 9, 1),
            monto_base=Decimal('150.00'),
            monto=Decimal('150.00'),
            fecha_vencimiento=date(2026, 9, 10),
            creada_por=self.admin,
        )
        Pago.objects.create(
            mensualidad=mensualidad,
            monto=Decimal('50.00'),
            fecha_pago=date(2026, 9, 5),
            registrado_por=self.admin,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/escuela/reportes/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['categorias'][0]['cobrado'], Decimal('50.00'))
        self.assertEqual(response.data['familias_con_deuda'][0]['deuda'], Decimal('100.00'))
        self.assertEqual(response.data['caja_por_usuario'][0]['operaciones'], 1)

    def test_inscripcion_publica_se_puede_enviar_sin_cuenta(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/escuela/publico/solicitudes/', {
            'categoria': self.categoria.id,
            'alumno_nombres': 'Carlos',
            'alumno_apellidos': 'Lopez',
            'documento': 'SOL-001',
            'tutor_nombre': 'Julia Lopez',
            'tutor_telefono': '73456789',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(SolicitudInscripcion.objects.filter(documento='SOL-001').exists())

    def test_aprobacion_con_grupo_lleno_crea_lista_de_espera(self):
        grupo = GrupoEntrenamiento.objects.create(
            categoria=self.categoria,
            nombre='Manana',
            entrenador=self.entrenador,
            dias='Lunes y miercoles',
            hora_inicio='08:00',
            hora_fin='09:00',
            lugar='Cancha principal',
            capacidad=1,
        )
        grupo.alumnos.add(self.alumno)
        solicitud = SolicitudInscripcion.objects.create(
            categoria=self.categoria,
            grupo=grupo,
            alumno_nombres='Sofia',
            alumno_apellidos='Mamani',
            documento='SOL-002',
            tutor_nombre='Rosa Mamani',
            tutor_telefono='74567890',
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f'/api/escuela/solicitudes/{solicitud.id}/revisar/',
            {'estado': 'APROBADA'},
            format='json',
        )

        solicitud.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(solicitud.estado, 'LISTA_ESPERA')
        self.assertTrue(ListaEspera.objects.filter(solicitud=solicitud).exists())
        self.assertFalse(Alumno.objects.filter(documento='SOL-002').exists())

    def test_movimiento_de_inventario_actualiza_stock_y_rechaza_faltante(self):
        producto = ProductoInventario.objects.create(
            nombre='Balon de entrenamiento',
            tipo='MATERIAL',
            stock=3,
            stock_minimo=1,
        )
        self.client.force_authenticate(self.admin)
        salida = self.client.post('/api/escuela/inventario-movimientos/', {
            'producto': producto.id,
            'tipo': 'SALIDA',
            'cantidad': 2,
            'motivo': 'Entrega a entrenador',
        }, format='json')
        producto.refresh_from_db()
        sin_stock = self.client.post('/api/escuela/inventario-movimientos/', {
            'producto': producto.id,
            'tipo': 'SALIDA',
            'cantidad': 2,
            'motivo': 'Salida no disponible',
        }, format='json')

        self.assertEqual(salida.status_code, 201)
        self.assertEqual(producto.stock, 1)
        self.assertEqual(sin_stock.status_code, 400)

    def test_tutor_solo_obtiene_sus_alumnos(self):
        tutor = User.objects.create_user(username='tutor-escuela', password='clave', rol='TUTOR')
        self.alumno.tutor_usuario = tutor
        self.alumno.save(update_fields=['tutor_usuario'])
        Alumno.objects.create(
            categoria=self.categoria,
            nombres='Alumno',
            apellidos='Ajeno',
            documento='AL-OTRO',
            tutor_nombre='Otro Tutor',
            tutor_telefono='75678901',
        )
        self.client.force_authenticate(tutor)
        response = self.client.get('/api/escuela/portal-tutor/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['familia']), 1)
        self.assertEqual(response.data['familia'][0]['alumno']['documento'], 'AL-001')

    def test_datos_administrativos_no_son_visibles_para_entrenador(self):
        self.client.force_authenticate(self.entrenador)

        self.assertEqual(self.client.get('/api/escuela/gastos/').status_code, 403)
        self.assertEqual(self.client.get('/api/escuela/inventario/').status_code, 403)
        self.assertEqual(self.client.get('/api/escuela/auditoria/').status_code, 403)
        self.assertEqual(self.client.get('/api/escuela/solicitudes/').status_code, 403)

    def test_acciones_clave_generan_auditoria(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/escuela/inventario/', {
            'nombre': 'Red reglamentaria',
            'tipo': 'MATERIAL',
            'stock': 1,
            'stock_minimo': 0,
            'costo_unitario': '300.00',
            'precio_venta': '0.00',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(RegistroAuditoria.objects.filter(modelo='ProductoInventario', accion='CREAR').exists())

    def test_admin_registra_entrenador_con_nombre_real_y_cuenta(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/escuela/entrenadores/', {
            'username': 'coach-real',
            'password': 'clave-segura',
            'first_name': 'Gabriela',
            'last_name': 'Flores Quispe',
            'documento': 'CI-9988',
            'telefono': '76543210',
            'email': 'gabriela@escuela.test',
            'especialidad': 'Categorias formativas',
            'fecha_ingreso': '2026-09-01',
            'activo': True,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        perfil = EntrenadorEscuela.objects.select_related('usuario').get(documento='CI-9988')
        self.assertEqual(perfil.nombre_completo, 'Gabriela Flores Quispe')
        self.assertEqual(perfil.usuario.rol, 'ENTRENADOR')
        self.assertTrue(perfil.usuario.check_password('clave-segura'))

    def test_editar_entrenador_sincroniza_nombre_y_estado_de_cuenta(self):
        perfil = EntrenadorEscuela.objects.create(usuario=self.entrenador, especialidad='Iniciacion')
        self.client.force_authenticate(self.admin)
        response = self.client.patch(f'/api/escuela/entrenadores/{perfil.id}/', {
            'first_name': 'Daniel',
            'last_name': 'Rojas',
            'activo': False,
        }, format='json')

        perfil.refresh_from_db()
        self.entrenador.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(perfil.nombre_completo, 'Daniel Rojas')
        self.assertFalse(self.entrenador.is_active)

    def test_entrenador_puede_consultar_fichas_pero_no_crearlas(self):
        EntrenadorEscuela.objects.create(usuario=self.entrenador)
        self.client.force_authenticate(self.entrenador)

        self.assertEqual(self.client.get('/api/escuela/entrenadores/').status_code, 200)
        self.assertEqual(self.client.post('/api/escuela/entrenadores/', {}, format='json').status_code, 403)
