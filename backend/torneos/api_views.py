from datetime import timedelta

from django.db import transaction
from rest_framework import exceptions, generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Credencial, Equipo, Jugador, Partido, SetPartido, Torneo
from .serializers import (
    CredencialSerializer,
    EquipoSerializer,
    GenerarFixtureSerializer,
    JugadorSerializer,
    PartidoSerializer,
    ResultadoPartidoSerializer,
    TorneoSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'rol', '') in ['ADMIN', 'ENTRENADOR']
        )


class IsEquipoOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'rol', '') in ['ADMIN', 'ENTRENADOR', 'DELEGADO']
        )

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if getattr(request.user, 'rol', '') in ['ADMIN', 'ENTRENADOR']:
            return True
        return obj.delegado_id == request.user.id


class IsJugadorOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'rol', '') in ['ADMIN', 'ENTRENADOR', 'DELEGADO']
        )

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if getattr(request.user, 'rol', '') in ['ADMIN', 'ENTRENADOR']:
            return True
        return obj.equipo.delegado_id == request.user.id


class TorneoListCreateAPIView(generics.ListCreateAPIView):
    queryset = Torneo.objects.all().order_by('-fecha_inicio')
    serializer_class = TorneoSerializer
    permission_classes = [IsAdminOrReadOnly]


class TorneoDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Torneo.objects.all()
    serializer_class = TorneoSerializer
    permission_classes = [IsAdminOrReadOnly]


class EquipoListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = EquipoSerializer
    permission_classes = [IsEquipoOwnerOrAdmin]

    def get_queryset(self):
        queryset = Equipo.objects.select_related('torneo', 'delegado').all()
        if getattr(self.request.user, 'rol', '') == 'DELEGADO':
            return queryset.filter(delegado=self.request.user)
        return queryset

    def perform_create(self, serializer):
        if getattr(self.request.user, 'rol', '') == 'DELEGADO':
            serializer.save(delegado=self.request.user)
            return
        serializer.save()


class EquipoDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EquipoSerializer
    permission_classes = [IsEquipoOwnerOrAdmin]

    def get_queryset(self):
        queryset = Equipo.objects.select_related('torneo', 'delegado').all()
        if getattr(self.request.user, 'rol', '') == 'DELEGADO':
            return queryset.filter(delegado=self.request.user)
        return queryset


class JugadorListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = JugadorSerializer
    permission_classes = [IsJugadorOwnerOrAdmin]

    def get_queryset(self):
        queryset = Jugador.objects.select_related('equipo', 'torneo').all()
        if getattr(self.request.user, 'rol', '') == 'DELEGADO':
            return queryset.filter(equipo__delegado=self.request.user)
        return queryset

    def perform_create(self, serializer):
        if getattr(self.request.user, 'rol', '') == 'DELEGADO':
            equipo = serializer.validated_data['equipo']
            if equipo.delegado_id != self.request.user.id:
                raise exceptions.PermissionDenied('Solo puedes registrar jugadores en tu equipo.')
            serializer.save(torneo=equipo.torneo)
            return
        serializer.save()


class JugadorDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = JugadorSerializer
    permission_classes = [IsJugadorOwnerOrAdmin]

    def get_queryset(self):
        queryset = Jugador.objects.select_related('equipo', 'torneo').all()
        if getattr(self.request.user, 'rol', '') == 'DELEGADO':
            return queryset.filter(equipo__delegado=self.request.user)
        return queryset


class CredencialListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = CredencialSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Credencial.objects.select_related('torneo', 'jugador', 'jugador__equipo').all()
        if getattr(self.request.user, 'rol', '') == 'DELEGADO':
            return queryset.filter(jugador__equipo__delegado=self.request.user)
        return queryset


class CredencialDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Credencial.objects.all()
    serializer_class = CredencialSerializer
    permission_classes = [IsAdminOrReadOnly]


class PartidoListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = PartidoSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Partido.objects.select_related('torneo', 'equipo_local', 'equipo_visitante', 'ganador').prefetch_related('sets')
        torneo_id = self.request.query_params.get('torneo')
        if getattr(self.request.user, 'rol', '') == 'DELEGADO':
            torneo_ids = Equipo.objects.filter(delegado=self.request.user).values_list('torneo_id', flat=True)
            queryset = queryset.filter(torneo_id__in=torneo_ids)
        if torneo_id:
            queryset = queryset.filter(torneo_id=torneo_id)
        return queryset


class PartidoDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Partido.objects.select_related('torneo', 'equipo_local', 'equipo_visitante', 'ganador').prefetch_related('sets')
    serializer_class = PartidoSerializer
    permission_classes = [IsAdminOrReadOnly]


class GenerarFixtureAPIView(APIView):
    permission_classes = [IsAdminOrReadOnly]

    def post(self, request):
        serializer = GenerarFixtureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        torneo = data['torneo']
        equipos = list(torneo.equipos.all().order_by('id'))

        if len(equipos) < 2:
            return Response(
                {'detail': 'Se necesitan al menos 2 equipos para generar fixture.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if torneo.partidos.exists() and not data['reemplazar']:
            return Response(
                {'detail': 'Este torneo ya tiene partidos. Envia reemplazar=true para regenerar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cruces = generar_cruces_round_robin(equipos)
        if data['ida_y_vuelta']:
            total_rondas = max(ronda for ronda, _local, _visitante in cruces)
            cruces += [
                (ronda + total_rondas, visitante, local)
                for ronda, local, visitante in cruces
            ]

        with transaction.atomic():
            if data['reemplazar']:
                torneo.partidos.all().delete()

            partidos = []
            for index, (ronda, local, visitante) in enumerate(cruces, start=1):
                bloque_fecha = (index - 1) // data['partidos_por_fecha']
                fecha_partido = data['fecha_inicio'] + timedelta(days=bloque_fecha * data['dias_entre_fechas'])
                partidos.append(Partido.objects.create(
                    torneo=torneo,
                    equipo_local=local,
                    equipo_visitante=visitante,
                    fecha=fecha_partido,
                    hora=data['hora_partido'],
                    lugar=data['lugar'],
                    ronda=ronda,
                    orden=index,
                ))

        return Response(PartidoSerializer(partidos, many=True).data, status=status.HTTP_201_CREATED)


class ResultadoPartidoAPIView(APIView):
    permission_classes = [IsAdminOrReadOnly]

    def post(self, request, pk):
        partido = Partido.objects.select_related('equipo_local', 'equipo_visitante').get(pk=pk)
        serializer = ResultadoPartidoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            partido.sets.all().delete()
            for set_data in serializer.validated_data['sets']:
                SetPartido.objects.create(partido=partido, **set_data)
            partido.actualizar_resultado()

        partido.refresh_from_db()
        return Response(PartidoSerializer(partido).data)


class PosicionesAPIView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request):
        torneo_id = request.query_params.get('torneo')
        equipos = Equipo.objects.select_related('torneo').all()
        if torneo_id:
            equipos = equipos.filter(torneo_id=torneo_id)

        tabla = {
            equipo.id: {
                'equipo': equipo.id,
                'equipo_nombre': equipo.nombre,
                'torneo': equipo.torneo_id,
                'torneo_nombre': equipo.torneo.nombre,
                'pj': 0,
                'pg': 0,
                'pp': 0,
                'sf': 0,
                'sc': 0,
                'pf': 0,
                'pc': 0,
                'dif': 0,
                'pts': 0,
            }
            for equipo in equipos
        }

        partidos = Partido.objects.filter(estado='FINALIZADO').prefetch_related('sets')
        if torneo_id:
            partidos = partidos.filter(torneo_id=torneo_id)

        for partido in partidos:
            if partido.equipo_local_id not in tabla or partido.equipo_visitante_id not in tabla:
                continue

            local = tabla[partido.equipo_local_id]
            visitante = tabla[partido.equipo_visitante_id]
            sets_local = 0
            sets_visitante = 0

            local['pj'] += 1
            visitante['pj'] += 1
            local['pts'] += partido.puntos_local
            visitante['pts'] += partido.puntos_visitante

            if partido.ganador_id == partido.equipo_local_id:
                local['pg'] += 1
                visitante['pp'] += 1
            elif partido.ganador_id == partido.equipo_visitante_id:
                visitante['pg'] += 1
                local['pp'] += 1

            for set_partido in partido.sets.all():
                local['pf'] += set_partido.puntos_local
                local['pc'] += set_partido.puntos_visitante
                visitante['pf'] += set_partido.puntos_visitante
                visitante['pc'] += set_partido.puntos_local

                if set_partido.puntos_local > set_partido.puntos_visitante:
                    sets_local += 1
                else:
                    sets_visitante += 1

            local['sf'] += sets_local
            local['sc'] += sets_visitante
            visitante['sf'] += sets_visitante
            visitante['sc'] += sets_local

        posiciones = []
        for row in tabla.values():
            row['dif'] = row['pf'] - row['pc']
            posiciones.append(row)

        posiciones.sort(key=lambda item: (item['pts'], item['pg'], item['dif'], item['pf']), reverse=True)
        for index, row in enumerate(posiciones, start=1):
            row['posicion'] = index

        return Response(posiciones)


def generar_cruces_round_robin(equipos):
    participantes = list(equipos)
    if len(participantes) % 2:
        participantes.append(None)

    total = len(participantes)
    rondas = total - 1
    mitad = total // 2
    cruces = []

    for ronda in range(1, rondas + 1):
        for index in range(mitad):
            local = participantes[index]
            visitante = participantes[total - 1 - index]
            if local and visitante:
                if ronda % 2 == 0:
                    local, visitante = visitante, local
                cruces.append((ronda, local, visitante))

        participantes = [participantes[0]] + [participantes[-1]] + participantes[1:-1]

    return cruces
