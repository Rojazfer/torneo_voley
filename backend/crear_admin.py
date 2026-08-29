#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from cuentas.models import Usuario

# Verificar si ya existe el usuario admin
if Usuario.objects.filter(username='admin').exists():
    print("El usuario admin ya existe.")
else:
    # Crear usuario admin
    admin = Usuario.objects.create_superuser(
        username='admin',
        password='admin123',
        email='admin@torneo.com'
    )
    print(f"✅ Usuario admin creado exitosamente")
    print(f"   Username: {admin.username}")
    print(f"   Email: {admin.email}")
    print(f"   Rol: {admin.rol}")
