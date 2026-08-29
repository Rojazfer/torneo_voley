from django.urls import path

from . import api_views

urlpatterns = [
    path('torneos/', api_views.TorneoListCreateAPIView.as_view(), name='api_torneos'),
    path('torneos/<int:pk>/', api_views.TorneoDetailAPIView.as_view(), name='api_torneo_detail'),
    path('equipos/', api_views.EquipoListCreateAPIView.as_view(), name='api_equipos'),
    path('equipos/<int:pk>/', api_views.EquipoDetailAPIView.as_view(), name='api_equipo_detail'),
    path('jugadores/', api_views.JugadorListCreateAPIView.as_view(), name='api_jugadores'),
    path('jugadores/<int:pk>/', api_views.JugadorDetailAPIView.as_view(), name='api_jugador_detail'),
    path('credenciales/', api_views.CredencialListCreateAPIView.as_view(), name='api_credenciales'),
    path('credenciales/<int:pk>/', api_views.CredencialDetailAPIView.as_view(), name='api_credencial_detail'),
    path('partidos/', api_views.PartidoListCreateAPIView.as_view(), name='api_partidos'),
    path('partidos/<int:pk>/', api_views.PartidoDetailAPIView.as_view(), name='api_partido_detail'),
    path('partidos/<int:pk>/resultado/', api_views.ResultadoPartidoAPIView.as_view(), name='api_partido_resultado'),
    path('fixture/generar/', api_views.GenerarFixtureAPIView.as_view(), name='api_generar_fixture'),
    path('posiciones/', api_views.PosicionesAPIView.as_view(), name='api_posiciones'),
]
