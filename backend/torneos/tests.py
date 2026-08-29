from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Equipo, Jugador, Partido, Torneo

User = get_user_model()


class TorneoAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='adminaya',
            email='admin@ayacucho.com',
            password='123456',
            rol='ADMIN',
        )
        self.client.force_authenticate(user=self.user)

    def test_list_torneos(self):
        Torneo.objects.create(
            nombre='Torneo Nacional',
            categoria='Senior',
            fecha_inicio='2026-09-10',
            fecha_fin='2026-09-15',
            lugar='Ayacucho',
            descripcion='Torneo de prueba',
            estado='PROGRAMADO',
        )

        response = self.client.get('/api/torneos/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_jugador_via_api(self):
        torneo = Torneo.objects.create(
            nombre='Torneo prueba',
            categoria='Junior',
            fecha_inicio='2026-10-01',
            fecha_fin='2026-10-05',
            lugar='Villa',
            descripcion='Prueba',
            estado='PROGRAMADO',
        )
        equipo = Equipo.objects.create(
            nombre='Ayacucho 1',
            categoria='Junior',
            color_principal='Rojo',
            torneo=torneo,
        )

        payload = {
            'nombre': 'Marco',
            'apellido': 'Pérez',
            'documento': '12345678',
            'fecha_nacimiento': '2000-01-15',
            'posicion': 'PUNTA',
            'equipo': equipo.id,
            'torneo': torneo.id,
            'activo': True,
        }

        response = self.client.post('/api/jugadores/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Jugador.objects.count(), 1)

    def test_generate_fixture_register_result_and_positions(self):
        torneo = Torneo.objects.create(
            nombre='Torneo fixture',
            categoria='Senior',
            fecha_inicio='2026-11-01',
            fecha_fin='2026-11-05',
            lugar='Coliseo',
            descripcion='Prueba fixture',
            estado='PROGRAMADO',
        )
        local = Equipo.objects.create(nombre='Central', categoria='Senior', color_principal='Rojo', torneo=torneo)
        visitante = Equipo.objects.create(nombre='Nacional', categoria='Senior', color_principal='Azul', torneo=torneo)
        Equipo.objects.create(nombre='Municipal', categoria='Senior', color_principal='Verde', torneo=torneo)
        Equipo.objects.create(nombre='Universitario', categoria='Senior', color_principal='Blanco', torneo=torneo)

        fixture_response = self.client.post('/api/fixture/generar/', {
            'torneo': torneo.id,
            'fecha_inicio': '2026-11-01',
            'hora_partido': '19:30',
            'lugar': 'Coliseo',
            'partidos_por_fecha': 2,
            'dias_entre_fechas': 1,
        }, format='json')

        self.assertEqual(fixture_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Partido.objects.count(), 6)
        self.assertEqual(Partido.objects.order_by('orden')[0].fecha.isoformat(), '2026-11-01')
        self.assertEqual(Partido.objects.order_by('orden')[2].fecha.isoformat(), '2026-11-02')

        partido = Partido.objects.filter(equipo_local=local, equipo_visitante=visitante).first()
        self.assertIsNotNone(partido)
        resultado_response = self.client.post(f'/api/partidos/{partido.id}/resultado/', {
            'sets': [
                {'numero': 1, 'puntos_local': 25, 'puntos_visitante': 12},
                {'numero': 2, 'puntos_local': 25, 'puntos_visitante': 20},
                {'numero': 3, 'puntos_local': 18, 'puntos_visitante': 25},
                {'numero': 4, 'puntos_local': 25, 'puntos_visitante': 19},
            ],
        }, format='json')

        self.assertEqual(resultado_response.status_code, status.HTTP_200_OK)
        partido.refresh_from_db()
        self.assertEqual(partido.ganador_id, local.id)
        self.assertEqual(partido.puntos_local, 2)
        self.assertEqual(partido.puntos_visitante, 1)

        posiciones_response = self.client.get(f'/api/posiciones/?torneo={torneo.id}')

        self.assertEqual(posiciones_response.status_code, status.HTTP_200_OK)
        posiciones = {row['equipo']: row for row in posiciones_response.data}
        self.assertEqual(posiciones[local.id]['pts'], 2)
        self.assertEqual(posiciones[local.id]['pf'], 93)
        self.assertEqual(posiciones[local.id]['pc'], 76)
        self.assertEqual(posiciones[visitante.id]['pts'], 1)
        self.assertEqual(posiciones[visitante.id]['pf'], 76)
        self.assertEqual(posiciones[visitante.id]['pc'], 93)

    def test_delegate_can_register_only_one_team_per_tournament(self):
        delegado = User.objects.create_user(
            username='delegado1',
            email='delegado1@ayacucho.com',
            password='123456',
            rol='DELEGADO',
        )
        torneo = Torneo.objects.create(
            nombre='Torneo delegado',
            categoria='Senior',
            fecha_inicio='2026-12-01',
            fecha_fin='2026-12-05',
            lugar='Coliseo',
            descripcion='Prueba delegado',
            estado='PROGRAMADO',
        )

        self.client.force_authenticate(user=delegado)
        first_response = self.client.post('/api/equipos/', {
            'nombre': 'Equipo unico',
            'categoria': 'Senior',
            'color_principal': 'Rojo',
            'torneo': torneo.id,
        }, format='json')
        second_response = self.client.post('/api/equipos/', {
            'nombre': 'Equipo repetido',
            'categoria': 'Senior',
            'color_principal': 'Azul',
            'torneo': torneo.id,
        }, format='json')

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Equipo.objects.filter(delegado=delegado, torneo=torneo).count(), 1)

    def test_delegate_cannot_register_player_in_other_team(self):
        delegado = User.objects.create_user(
            username='delegado2',
            email='delegado2@ayacucho.com',
            password='123456',
            rol='DELEGADO',
        )
        otro_delegado = User.objects.create_user(
            username='delegado3',
            email='delegado3@ayacucho.com',
            password='123456',
            rol='DELEGADO',
        )
        torneo = Torneo.objects.create(
            nombre='Torneo jugadores',
            categoria='Senior',
            fecha_inicio='2026-12-10',
            fecha_fin='2026-12-15',
            lugar='Coliseo',
            descripcion='Prueba jugadores',
            estado='PROGRAMADO',
        )
        equipo_ajeno = Equipo.objects.create(
            nombre='Equipo ajeno',
            categoria='Senior',
            color_principal='Azul',
            torneo=torneo,
            delegado=otro_delegado,
        )

        self.client.force_authenticate(user=delegado)
        response = self.client.post('/api/jugadores/', {
            'nombre': 'Pedro',
            'apellido': 'Lopez',
            'documento': '99887766',
            'fecha_nacimiento': '2001-03-10',
            'posicion': 'PUNTA',
            'equipo': equipo_ajeno.id,
            'torneo': torneo.id,
            'activo': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Jugador.objects.filter(documento='99887766').count(), 0)
