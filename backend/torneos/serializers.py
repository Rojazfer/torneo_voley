from rest_framework import serializers

from .models import Credencial, Equipo, Jugador, Partido, SetPartido, Torneo


class TorneoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Torneo
        fields = '__all__'


class EquipoSerializer(serializers.ModelSerializer):
    delegado_username = serializers.CharField(source='delegado.username', read_only=True)

    class Meta:
        model = Equipo
        fields = '__all__'
        read_only_fields = ['delegado']

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        if request and request.method == 'POST' and getattr(user, 'rol', '') == 'DELEGADO':
            torneo = attrs.get('torneo')
            if Equipo.objects.filter(delegado=user, torneo=torneo).exists():
                raise serializers.ValidationError({
                    'torneo': 'Ya registraste un equipo en este campeonato.'
                })

        return attrs


class JugadorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Jugador
        fields = '__all__'


class CredencialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Credencial
        fields = '__all__'
        extra_kwargs = {
            'codigo': {'required': False},
            'jugador': {'required': False, 'allow_null': True},
        }


class SetPartidoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SetPartido
        fields = ['id', 'numero', 'puntos_local', 'puntos_visitante']


class PartidoSerializer(serializers.ModelSerializer):
    sets = SetPartidoSerializer(many=True, read_only=True)
    torneo_nombre = serializers.CharField(source='torneo.nombre', read_only=True)
    equipo_local_nombre = serializers.CharField(source='equipo_local.nombre', read_only=True)
    equipo_local_logo = serializers.CharField(source='equipo_local.logo_data_url', read_only=True)
    equipo_visitante_nombre = serializers.CharField(source='equipo_visitante.nombre', read_only=True)
    equipo_visitante_logo = serializers.CharField(source='equipo_visitante.logo_data_url', read_only=True)
    ganador_nombre = serializers.CharField(source='ganador.nombre', read_only=True)

    class Meta:
        model = Partido
        fields = [
            'id',
            'torneo',
            'torneo_nombre',
            'equipo_local',
            'equipo_local_nombre',
            'equipo_local_logo',
            'equipo_visitante',
            'equipo_visitante_nombre',
            'equipo_visitante_logo',
            'fecha',
            'hora',
            'lugar',
            'ronda',
            'orden',
            'estado',
            'ganador',
            'ganador_nombre',
            'puntos_local',
            'puntos_visitante',
            'sets',
        ]
        read_only_fields = ['ganador', 'puntos_local', 'puntos_visitante']


class GenerarFixtureSerializer(serializers.Serializer):
    torneo = serializers.PrimaryKeyRelatedField(queryset=Torneo.objects.all())
    fecha_inicio = serializers.DateField()
    hora_partido = serializers.TimeField()
    lugar = serializers.CharField(max_length=200)
    partidos_por_fecha = serializers.IntegerField(min_value=1, default=5)
    dias_entre_fechas = serializers.IntegerField(min_value=1, default=1)
    ida_y_vuelta = serializers.BooleanField(default=False)
    reemplazar = serializers.BooleanField(default=False)


class ResultadoPartidoSerializer(serializers.Serializer):
    sets = SetPartidoSerializer(many=True)

    def validate_sets(self, sets):
        numeros = [item['numero'] for item in sets]
        if len(numeros) != len(set(numeros)):
            raise serializers.ValidationError('No puede haber sets repetidos.')

        for item in sets:
            if item['puntos_local'] == item['puntos_visitante']:
                raise serializers.ValidationError('Un set no puede terminar empatado.')

        return sorted(sets, key=lambda item: item['numero'])
