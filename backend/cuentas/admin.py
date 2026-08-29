from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = (
        'username',
        'email',
        'rol',
        'is_staff',
        'is_active',
        'fecha_registro',
    )
    list_filter = ('rol', 'is_staff', 'is_active', 'is_superuser')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('username',)

    fieldsets = UserAdmin.fieldsets + (
        ('Informacion del torneo', {
            'fields': ('rol', 'telefono', 'foto'),
        }),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Informacion del torneo', {
            'fields': ('email', 'rol', 'telefono', 'foto'),
        }),
    )
