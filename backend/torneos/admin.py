from django.contrib import admin

from .models import Credencial, Equipo, Jugador, Partido, SetPartido, Torneo


@admin.register(Torneo)
class TorneoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'categoria', 'fecha_inicio', 'fecha_fin', 'estado', 'lugar')
    list_filter = ('estado', 'categoria')
    search_fields = ('nombre', 'lugar')


@admin.register(Equipo)
class EquipoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'categoria', 'color_principal', 'torneo', 'delegado')
    search_fields = ('nombre', 'delegado__username')


@admin.register(Jugador)
class JugadorAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'apellido', 'documento', 'equipo', 'torneo', 'activo')
    list_filter = ('activo', 'torneo')
    search_fields = ('nombre', 'apellido', 'documento')


@admin.register(Credencial)
class CredencialAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'tipo', 'torneo', 'jugador')
    list_filter = ('tipo', 'torneo')
    search_fields = ('codigo', 'jugador__nombre', 'jugador__apellido')


class SetPartidoInline(admin.TabularInline):
    model = SetPartido
    extra = 0


@admin.register(Partido)
class PartidoAdmin(admin.ModelAdmin):
    list_display = ('torneo', 'equipo_local', 'equipo_visitante', 'fecha', 'hora', 'estado', 'ganador')
    list_filter = ('torneo', 'estado', 'fecha')
    search_fields = ('equipo_local__nombre', 'equipo_visitante__nombre', 'lugar')
    inlines = [SetPartidoInline]
