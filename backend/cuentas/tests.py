from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class CuentasAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_admin_user_profile_endpoint(self):
        user = User.objects.create_user(
            username='admin',
            email='admin@ayacucho.com',
            password='123456',
            rol='ADMIN',
        )
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'admin')
        self.assertEqual(response.data['rol'], 'ADMIN')

    def test_dashboard_stats_for_admin(self):
        user = User.objects.create_user(
            username='admin2',
            email='admin2@ayacucho.com',
            password='123456',
            rol='ADMIN',
        )
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/dashboard/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_torneos', response.data)
        self.assertIn('total_equipos', response.data)
        self.assertIn('total_jugadores', response.data)
