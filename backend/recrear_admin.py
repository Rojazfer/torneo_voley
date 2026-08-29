#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from cuentas.models import Usuario

# Eliminar el usuario admin anterior si existe
Usuario.objects.filter(username='admin').delete()
print("❌ Usuario admin anterior eliminado")

# Crear nuevo usuario admin
admin = Usuario.objects.create_superuser(
    username='admin',
    password='admin123',
    email='admin@torneo.com'
)
print(f"✅ Usuario admin creado exitosamente")
print(f"   Username: {admin.username}")
print(f"   Email: {admin.email}")
print(f"   Rol: {admin.rol}")
print(f"   is_active: {admin.is_active}")
print(f"   is_staff: {admin.is_staff}")
print(f"   is_superuser: {admin.is_superuser}")

# Verificar que la contraseña funciona
from django.contrib.auth import authenticate
user = authenticate(username='admin', password='admin123')
if user:
    print(f"\n✅ Autenticación exitosa: {user}")
else:
    print(f"\n❌ Error: La contraseña no se pudo verificar")
