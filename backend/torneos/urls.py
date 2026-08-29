from django.urls import path

from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('torneos/', views.torneos_list, name='torneos_list'),
    path('torneos/nuevo/', views.torneo_nuevo, name='torneo_nuevo'),
    path('torneos/<int:pk>/', views.torneo_detalle, name='torneo_detalle'),
    path('torneos/<int:pk>/editar/', views.torneo_editar, name='torneo_editar'),
    path('equipos/', views.equipos_list, name='equipos_list'),
    path('equipos/nuevo/', views.equipo_nuevo, name='equipo_nuevo'),
    path('jugadores/', views.jugadores_list, name='jugadores_list'),
    path('jugadores/nuevo/', views.jugador_nuevo, name='jugador_nuevo'),
    path('credenciales/', views.credenciales_list, name='credenciales_list'),
    path('credenciales/generar/<int:jugador_id>/', views.generar_credencial, name='generar_credencial'),
    path('buscar/', views.buscar, name='buscar'),
]
