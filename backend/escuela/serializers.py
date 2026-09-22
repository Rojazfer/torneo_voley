from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import (
    Alumno, CambioHorarioGrupo, CategoriaEscuela, DescuentoAlumno, DocumentoAlumno, EntregaUniforme, EvaluacionDeportiva,
    EntrenadorEscuela, FichaMedica, GastoEscuela, GrupoEntrenamiento, ListaEspera, Mensualidad,
    MovimientoInventario, Pago, PlantillaMensaje, PrestamoMaterial,
    ProductoInventario, RegistroAuditoria, RegistroMensaje, SolicitudInscripcion,
)

User = get_user_model()


class EntrenadorEscuelaSerializer(serializers.ModelSerializer):
    usuario = serializers.IntegerField(source='usuario_id', read_only=True)
    username = serializers.CharField(source='usuario.username')
    first_name = serializers.CharField(source='usuario.first_name')
    last_name = serializers.CharField(source='usuario.last_name')
    email = serializers.EmailField(source='usuario.email')
    telefono = serializers.CharField(source='usuario.telefono', required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=6)
    nombre_completo = serializers.CharField(read_only=True)

    class Meta:
        model = EntrenadorEscuela
        fields = [
            'id', 'usuario', 'username', 'password', 'first_name', 'last_name',
            'nombre_completo', 'documento', 'telefono', 'email', 'fecha_nacimiento',
            'especialidad', 'fecha_ingreso', 'activo', 'observaciones',
            'fecha_creacion', 'fecha_actualizacion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_actualizacion']

    def validate(self, attrs):
        datos_usuario = attrs.get('usuario', {})
        usuario_actual = self.instance.usuario if self.instance else None
        username = datos_usuario.get('username', getattr(usuario_actual, 'username', ''))
        email = datos_usuario.get('email', getattr(usuario_actual, 'email', ''))
        usuarios = User.objects.all()
        if usuario_actual:
            usuarios = usuarios.exclude(pk=usuario_actual.pk)
        if usuarios.filter(username__iexact=username).exists():
            raise serializers.ValidationError({'username': 'Este nombre de usuario ya existe.'})
        if usuarios.filter(email__iexact=email).exists():
            raise serializers.ValidationError({'email': 'Este correo ya esta registrado.'})
        if not self.instance and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'La contrasena inicial es obligatoria.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        datos_usuario = validated_data.pop('usuario')
        password = validated_data.pop('password')
        usuario = User.objects.create_user(password=password, rol='ENTRENADOR', **datos_usuario)
        usuario.is_active = validated_data.get('activo', True)
        usuario.save(update_fields=['is_active'])
        return EntrenadorEscuela.objects.create(usuario=usuario, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        datos_usuario = validated_data.pop('usuario', {})
        password = validated_data.pop('password', None)
        for campo, valor in datos_usuario.items():
            setattr(instance.usuario, campo, valor)
        for campo, valor in validated_data.items():
            setattr(instance, campo, valor)
        if password:
            instance.usuario.set_password(password)
        instance.usuario.rol = 'ENTRENADOR'
        instance.usuario.is_active = instance.activo
        instance.usuario.save()
        instance.save()
        return instance


class EntrenadorResumenSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'nombre_completo']

    def get_nombre_completo(self, obj):
        return obj.get_full_name() or obj.username


class CategoriaEscuelaSerializer(serializers.ModelSerializer):
    entrenadores_detalle = EntrenadorResumenSerializer(source='entrenadores', many=True, read_only=True)
    total_alumnos = serializers.IntegerField(read_only=True)

    class Meta:
        model = CategoriaEscuela
        fields = '__all__'

    def validate(self, attrs):
        minima = attrs.get('edad_minima', getattr(self.instance, 'edad_minima', None))
        maxima = attrs.get('edad_maxima', getattr(self.instance, 'edad_maxima', None))
        if minima is not None and maxima is not None and minima > maxima:
            raise serializers.ValidationError({'edad_maxima': 'Debe ser mayor o igual a la edad minima.'})
        return attrs


class AlumnoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    entrenador_nombre = serializers.SerializerMethodField()
    nombre_completo = serializers.SerializerMethodField()
    monto_mensual = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    deuda_total = serializers.SerializerMethodField()

    class Meta:
        model = Alumno
        fields = '__all__'
        read_only_fields = ['creado_por']

    def get_nombre_completo(self, obj):
        return f'{obj.nombres} {obj.apellidos}'.strip()

    def get_entrenador_nombre(self, obj):
        if not obj.entrenador:
            return ''
        return obj.entrenador.get_full_name() or obj.entrenador.username

    def get_deuda_total(self, obj):
        return sum((mensualidad.saldo for mensualidad in obj.mensualidades.all() if mensualidad.estado != 'ANULADA'), start=0)

    def validate_entrenador(self, value):
        if value and getattr(value, 'rol', '') != 'ENTRENADOR':
            raise serializers.ValidationError('El usuario seleccionado no es entrenador.')
        return value


class PagoSerializer(serializers.ModelSerializer):
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Pago
        fields = '__all__'
        read_only_fields = ['registrado_por']

    def get_registrado_por_nombre(self, obj):
        if not obj.registrado_por:
            return ''
        return obj.registrado_por.get_full_name() or obj.registrado_por.username

    def validate(self, attrs):
        mensualidad = attrs.get('mensualidad', getattr(self.instance, 'mensualidad', None))
        monto = attrs.get('monto', getattr(self.instance, 'monto', None))
        if mensualidad and mensualidad.estado == Mensualidad.Estados.ANULADA:
            raise serializers.ValidationError('No se puede registrar un pago en una mensualidad anulada.')
        if mensualidad and monto:
            saldo_disponible = mensualidad.saldo
            if self.instance and self.instance.mensualidad_id == mensualidad.id:
                saldo_disponible += self.instance.monto
            if monto > saldo_disponible:
                raise serializers.ValidationError({'monto': f'El monto supera el saldo de Bs {saldo_disponible}.'})
        return attrs


class MensualidadSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)
    categoria_nombre = serializers.CharField(source='alumno.categoria.nombre', read_only=True)
    tutor_nombre = serializers.CharField(source='alumno.tutor_nombre', read_only=True)
    tutor_telefono = serializers.CharField(source='alumno.tutor_telefono', read_only=True)
    total_pagado = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    saldo = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    vencida = serializers.BooleanField(read_only=True)
    pagos = PagoSerializer(many=True, read_only=True)

    class Meta:
        model = Mensualidad
        fields = '__all__'
        read_only_fields = ['creada_por']

    def validate_periodo(self, value):
        return value.replace(day=1)


class PlantillaMensajeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaMensaje
        fields = '__all__'
        read_only_fields = ['creada_por']


class RegistroMensajeSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)
    enviado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = RegistroMensaje
        fields = '__all__'
        read_only_fields = ['enviado_por']

    def get_enviado_por_nombre(self, obj):
        if not obj.enviado_por:
            return ''
        return obj.enviado_por.get_full_name() or obj.enviado_por.username


class GenerarMensualidadesSerializer(serializers.Serializer):
    periodo = serializers.DateField()
    categoria = serializers.PrimaryKeyRelatedField(queryset=CategoriaEscuela.objects.all(), required=False)

    def validate_periodo(self, value):
        return value.replace(day=1)


class GrupoEntrenamientoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    entrenador_nombre = serializers.SerializerMethodField()
    total_alumnos = serializers.IntegerField(source='alumnos.count', read_only=True)

    class Meta:
        model = GrupoEntrenamiento
        fields = '__all__'

    def get_entrenador_nombre(self, obj):
        if not obj.entrenador:
            return ''
        return obj.entrenador.get_full_name() or obj.entrenador.username

    def validate(self, attrs):
        inicio = attrs.get('hora_inicio', getattr(self.instance, 'hora_inicio', None))
        fin = attrs.get('hora_fin', getattr(self.instance, 'hora_fin', None))
        categoria = attrs.get('categoria', getattr(self.instance, 'categoria', None))
        alumnos = attrs.get('alumnos')
        if inicio and fin and inicio >= fin:
            raise serializers.ValidationError({'hora_fin': 'La hora final debe ser posterior a la hora inicial.'})
        if alumnos is not None and categoria:
            ajenos = [alumno.id for alumno in alumnos if alumno.categoria_id != categoria.id]
            if ajenos:
                raise serializers.ValidationError({'alumnos': 'Todos los alumnos deben pertenecer a la categoria del grupo.'})
        return attrs


class CambioHorarioGrupoSerializer(serializers.ModelSerializer):
    grupo_nombre = serializers.CharField(source='grupo.__str__', read_only=True)
    categoria_nombre = serializers.CharField(source='grupo.categoria.nombre', read_only=True)

    class Meta:
        model = CambioHorarioGrupo
        fields = '__all__'
        read_only_fields = ['creado_por']

    def validate(self, attrs):
        inicio = attrs.get('hora_inicio', getattr(self.instance, 'hora_inicio', None))
        fin = attrs.get('hora_fin', getattr(self.instance, 'hora_fin', None))
        if inicio and fin and inicio >= fin:
            raise serializers.ValidationError({'hora_fin': 'La hora final debe ser posterior a la inicial.'})
        return attrs


class DescuentoAlumnoSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)

    class Meta:
        model = DescuentoAlumno
        fields = '__all__'
        read_only_fields = ['autorizado_por']

    def validate(self, attrs):
        tipo = attrs.get('tipo', getattr(self.instance, 'tipo', None))
        valor = attrs.get('valor', getattr(self.instance, 'valor', None))
        inicio = attrs.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        fin = attrs.get('fecha_fin', getattr(self.instance, 'fecha_fin', None))
        if tipo == 'PORCENTAJE' and valor and valor > 100:
            raise serializers.ValidationError({'valor': 'El porcentaje no puede superar 100.'})
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({'fecha_fin': 'La fecha final no puede ser anterior al inicio.'})
        return attrs


class EvaluacionDeportivaSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)
    categoria_nombre = serializers.CharField(source='alumno.categoria.nombre', read_only=True)
    promedio = serializers.FloatField(read_only=True)
    evaluador_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EvaluacionDeportiva
        fields = '__all__'
        read_only_fields = ['evaluado_por']

    def get_evaluador_nombre(self, obj):
        if not obj.evaluado_por:
            return ''
        return obj.evaluado_por.get_full_name() or obj.evaluado_por.username


class FichaMedicaSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)
    categoria_nombre = serializers.CharField(source='alumno.categoria.nombre', read_only=True)

    class Meta:
        model = FichaMedica
        fields = '__all__'
        read_only_fields = ['actualizado_por']


class EntregaUniformeSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)

    class Meta:
        model = EntregaUniforme
        fields = '__all__'
        read_only_fields = ['registrado_por']


class DocumentoAlumnoSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)

    class Meta:
        model = DocumentoAlumno
        fields = '__all__'
        read_only_fields = ['subido_por']


class PrestamoMaterialSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)

    class Meta:
        model = PrestamoMaterial
        fields = '__all__'
        read_only_fields = ['registrado_por']


class SolicitudInscripcionSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    grupo_nombre = serializers.CharField(source='grupo.nombre', read_only=True)

    class Meta:
        model = SolicitudInscripcion
        fields = '__all__'
        read_only_fields = ['estado', 'respuesta', 'revisada_por', 'fecha_revision']

    def validate(self, attrs):
        grupo = attrs.get('grupo')
        categoria = attrs.get('categoria')
        if grupo and categoria and grupo.categoria_id != categoria.id:
            raise serializers.ValidationError({'grupo': 'El grupo no pertenece a la categoria seleccionada.'})
        return attrs


class SolicitudRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolicitudInscripcion
        fields = ['estado', 'respuesta']


class ListaEsperaSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    grupo_nombre = serializers.CharField(source='grupo.nombre', read_only=True)

    class Meta:
        model = ListaEspera
        fields = '__all__'


class GastoEscuelaSerializer(serializers.ModelSerializer):
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = GastoEscuela
        fields = '__all__'
        read_only_fields = ['registrado_por']

    def get_registrado_por_nombre(self, obj):
        if not obj.registrado_por:
            return ''
        return obj.registrado_por.get_full_name() or obj.registrado_por.username


class ProductoInventarioSerializer(serializers.ModelSerializer):
    bajo_stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductoInventario
        fields = '__all__'
        extra_kwargs = {'talla': {'required': False, 'allow_blank': True, 'default': ''}}

    def get_bajo_stock(self, obj):
        return obj.stock <= obj.stock_minimo


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    alumno_nombre = serializers.CharField(source='alumno.__str__', read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = '__all__'
        read_only_fields = ['registrado_por']


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = RegistroAuditoria
        fields = '__all__'

    def get_usuario_nombre(self, obj):
        if not obj.usuario:
            return 'Sistema'
        return obj.usuario.get_full_name() or obj.usuario.username
