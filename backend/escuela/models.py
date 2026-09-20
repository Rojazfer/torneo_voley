from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class CategoriaEscuela(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    edad_minima = models.PositiveSmallIntegerField(null=True, blank=True)
    edad_maxima = models.PositiveSmallIntegerField(null=True, blank=True)
    monto_mensual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    dia_vencimiento = models.PositiveSmallIntegerField(
        default=10,
        validators=[MinValueValidator(1), MaxValueValidator(28)],
    )
    descripcion = models.TextField(blank=True)
    entrenadores = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='categorias_escuela',
        limit_choices_to={'rol': 'ENTRENADOR'},
    )
    activa = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'categoria de escuela'
        verbose_name_plural = 'categorias de escuela'

    def __str__(self):
        return self.nombre


class Alumno(models.Model):
    class Estados(models.TextChoices):
        ACTIVO = 'ACTIVO', 'Activo'
        INACTIVO = 'INACTIVO', 'Inactivo'
        RETIRADO = 'RETIRADO', 'Retirado'

    categoria = models.ForeignKey(CategoriaEscuela, on_delete=models.PROTECT, related_name='alumnos')
    entrenador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alumnos_escuela',
        limit_choices_to={'rol': 'ENTRENADOR'},
    )
    tutor_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hijos_escuela',
        limit_choices_to={'rol': 'TUTOR'},
    )
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    documento = models.CharField(max_length=30, unique=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    fecha_inscripcion = models.DateField(default=timezone.localdate)
    direccion = models.CharField(max_length=250, blank=True)
    telefono = models.CharField(max_length=25, blank=True)
    tutor_nombre = models.CharField(max_length=160)
    tutor_parentesco = models.CharField(max_length=60, blank=True)
    tutor_telefono = models.CharField(max_length=25)
    tutor_telefono_alternativo = models.CharField(max_length=25, blank=True)
    tutor_email = models.EmailField(blank=True)
    monto_mensual_personalizado = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Si esta vacio se usa el monto de la categoria.',
    )
    estado = models.CharField(max_length=12, choices=Estados.choices, default=Estados.ACTIVO)
    observaciones = models.TextField(blank=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='alumnos_escuela_creados',
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['apellidos', 'nombres']

    @property
    def monto_mensual(self):
        if self.monto_mensual_personalizado is not None:
            return self.monto_mensual_personalizado
        return self.categoria.monto_mensual

    def __str__(self):
        return f'{self.apellidos}, {self.nombres}'


class GrupoEntrenamiento(models.Model):
    categoria = models.ForeignKey(CategoriaEscuela, on_delete=models.PROTECT, related_name='grupos')
    nombre = models.CharField(max_length=100)
    entrenador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='grupos_escuela',
        limit_choices_to={'rol': 'ENTRENADOR'},
    )
    alumnos = models.ManyToManyField(Alumno, blank=True, related_name='grupos')
    dias = models.CharField(max_length=120, help_text='Ejemplo: Lunes, Miercoles y Viernes')
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    lugar = models.CharField(max_length=160)
    capacidad = models.PositiveSmallIntegerField(default=20)
    activo = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ['categoria__nombre', 'nombre']
        constraints = [models.UniqueConstraint(fields=['categoria', 'nombre'], name='grupo_unico_por_categoria')]

    def __str__(self):
        return f'{self.categoria} - {self.nombre}'


class CambioHorarioGrupo(models.Model):
    grupo = models.ForeignKey(GrupoEntrenamiento, on_delete=models.CASCADE, related_name='cambios_horario')
    fecha = models.DateField()
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    lugar = models.CharField(max_length=160)
    motivo = models.CharField(max_length=250)
    notificado = models.BooleanField(default=False)
    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha', '-hora_inicio']

    def __str__(self):
        return f'{self.grupo} - {self.fecha}'


class DescuentoAlumno(models.Model):
    class Tipos(models.TextChoices):
        PORCENTAJE = 'PORCENTAJE', 'Porcentaje'
        MONTO = 'MONTO', 'Monto fijo'

    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='descuentos')
    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=12, choices=Tipos.choices, default=Tipos.PORCENTAJE)
    valor = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    fecha_inicio = models.DateField(default=timezone.localdate)
    fecha_fin = models.DateField(null=True, blank=True)
    motivo = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    autorizado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-activo', 'alumno__apellidos', 'nombre']

    def __str__(self):
        return f'{self.nombre} - {self.alumno}'


class Mensualidad(models.Model):
    class Estados(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        PARCIAL = 'PARCIAL', 'Pago parcial'
        PAGADA = 'PAGADA', 'Pagada'
        ANULADA = 'ANULADA', 'Anulada'

    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='mensualidades')
    periodo = models.DateField(help_text='Primer dia del mes facturado.')
    monto_base = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    descuento_aplicado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    detalle_descuento = models.CharField(max_length=250, blank=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_vencimiento = models.DateField()
    estado = models.CharField(max_length=12, choices=Estados.choices, default=Estados.PENDIENTE)
    observaciones = models.TextField(blank=True)
    creada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='mensualidades_creadas',
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-periodo', 'alumno__apellidos']
        constraints = [
            models.UniqueConstraint(fields=['alumno', 'periodo'], name='mensualidad_unica_por_periodo'),
        ]

    @property
    def total_pagado(self):
        return self.pagos.aggregate(total=models.Sum('monto'))['total'] or Decimal('0.00')

    @property
    def saldo(self):
        return max(self.monto - self.total_pagado, Decimal('0.00'))

    @property
    def vencida(self):
        return self.estado not in [self.Estados.PAGADA, self.Estados.ANULADA] and self.fecha_vencimiento < timezone.localdate()

    def actualizar_estado(self):
        if self.estado == self.Estados.ANULADA:
            return
        pagado = self.total_pagado
        nuevo_estado = self.Estados.PAGADA if pagado >= self.monto else self.Estados.PARCIAL if pagado > 0 else self.Estados.PENDIENTE
        if self.estado != nuevo_estado:
            self.estado = nuevo_estado
            self.save(update_fields=['estado'])

    def __str__(self):
        return f'{self.alumno} - {self.periodo:%m/%Y}'


class Pago(models.Model):
    class Metodos(models.TextChoices):
        EFECTIVO = 'EFECTIVO', 'Efectivo'
        TRANSFERENCIA = 'TRANSFERENCIA', 'Transferencia'
        QR = 'QR', 'QR'
        OTRO = 'OTRO', 'Otro'

    mensualidad = models.ForeignKey(Mensualidad, on_delete=models.CASCADE, related_name='pagos')
    monto = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    fecha_pago = models.DateField(default=timezone.localdate)
    metodo = models.CharField(max_length=20, choices=Metodos.choices, default=Metodos.EFECTIVO)
    numero_comprobante = models.CharField(max_length=80, blank=True)
    numero_recibo = models.CharField(max_length=30, unique=True, null=True, blank=True, editable=False)
    observaciones = models.TextField(blank=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_pago', '-id']

    def __str__(self):
        return f'{self.mensualidad} - Bs {self.monto}'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.numero_recibo:
            self.numero_recibo = f'REC-{self.fecha_pago.year}-{self.pk:06d}'
            type(self).objects.filter(pk=self.pk).update(numero_recibo=self.numero_recibo)


class EvaluacionDeportiva(models.Model):
    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='evaluaciones')
    fecha = models.DateField(default=timezone.localdate)
    saque = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    recepcion = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    ataque = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    bloqueo = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    defensa = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    condicion_fisica = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    observaciones = models.TextField(blank=True)
    evaluado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha', 'alumno__apellidos']

    @property
    def promedio(self):
        valores = [self.saque, self.recepcion, self.ataque, self.bloqueo, self.defensa, self.condicion_fisica]
        return round(sum(valores) / len(valores), 1)


class FichaMedica(models.Model):
    alumno = models.OneToOneField(Alumno, on_delete=models.CASCADE, related_name='ficha_medica')
    grupo_sanguineo = models.CharField(max_length=10, blank=True)
    alergias = models.TextField(blank=True)
    lesiones = models.TextField(blank=True)
    medicamentos = models.TextField(blank=True)
    restricciones = models.TextField(blank=True)
    seguro_medico = models.CharField(max_length=160, blank=True)
    numero_seguro = models.CharField(max_length=80, blank=True)
    contacto_emergencia = models.CharField(max_length=160)
    telefono_emergencia = models.CharField(max_length=25)
    certificado_vigente_hasta = models.DateField(null=True, blank=True)
    apto_para_entrenar = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True)
    actualizado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)


class DocumentoAlumno(models.Model):
    class Tipos(models.TextChoices):
        CERTIFICADO = 'CERTIFICADO', 'Certificado medico'
        IDENTIDAD = 'IDENTIDAD', 'Documento de identidad'
        AUTORIZACION = 'AUTORIZACION', 'Autorizacion'
        SEGURO = 'SEGURO', 'Seguro medico'
        OTRO = 'OTRO', 'Otro'

    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='documentos')
    tipo = models.CharField(max_length=20, choices=Tipos.choices, default=Tipos.CERTIFICADO)
    nombre = models.CharField(max_length=140)
    archivo = models.FileField(upload_to='escuela/documentos/%Y/%m/')
    fecha_vencimiento = models.DateField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    subido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_registro']


class EntregaUniforme(models.Model):
    class Estados(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        ENTREGADO = 'ENTREGADO', 'Entregado'
        DEVUELTO = 'DEVUELTO', 'Devuelto'

    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='uniformes')
    articulo = models.CharField(max_length=100)
    talla = models.CharField(max_length=20, blank=True)
    cantidad = models.PositiveSmallIntegerField(default=1)
    monto = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pagado = models.BooleanField(default=False)
    fecha_entrega = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=12, choices=Estados.choices, default=Estados.PENDIENTE)
    observaciones = models.TextField(blank=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_registro']


class PrestamoMaterial(models.Model):
    class Estados(models.TextChoices):
        PRESTADO = 'PRESTADO', 'Prestado'
        DEVUELTO = 'DEVUELTO', 'Devuelto'
        PERDIDO = 'PERDIDO', 'Perdido'

    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='materiales_prestados')
    material = models.CharField(max_length=120)
    cantidad = models.PositiveSmallIntegerField(default=1)
    fecha_prestamo = models.DateField(default=timezone.localdate)
    fecha_devolucion_prevista = models.DateField(null=True, blank=True)
    fecha_devolucion = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=10, choices=Estados.choices, default=Estados.PRESTADO)
    observaciones = models.TextField(blank=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_prestamo']


class PlantillaMensaje(models.Model):
    class Tipos(models.TextChoices):
        RECORDATORIO = 'RECORDATORIO', 'Recordatorio de pago'
        DEUDA = 'DEUDA', 'Aviso de deuda'
        CONFIRMACION = 'CONFIRMACION', 'Confirmacion de pago'
        GENERAL = 'GENERAL', 'Mensaje general'

    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=20, choices=Tipos.choices, default=Tipos.RECORDATORIO)
    contenido = models.TextField(help_text='Variables: {alumno}, {tutor}, {categoria}, {periodo}, {monto}, {saldo}, {vencimiento}.')
    activa = models.BooleanField(default=True)
    creada_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['tipo', 'nombre']

    def __str__(self):
        return self.nombre


class RegistroMensaje(models.Model):
    alumno = models.ForeignKey(Alumno, on_delete=models.CASCADE, related_name='mensajes')
    mensualidad = models.ForeignKey(Mensualidad, on_delete=models.SET_NULL, null=True, blank=True, related_name='mensajes')
    plantilla = models.ForeignKey(PlantillaMensaje, on_delete=models.SET_NULL, null=True, blank=True)
    telefono = models.CharField(max_length=25)
    contenido = models.TextField()
    enviado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha']


class SolicitudInscripcion(models.Model):
    class Estados(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        APROBADA = 'APROBADA', 'Aprobada'
        RECHAZADA = 'RECHAZADA', 'Rechazada'
        LISTA_ESPERA = 'LISTA_ESPERA', 'Lista de espera'

    categoria = models.ForeignKey(CategoriaEscuela, on_delete=models.PROTECT, related_name='solicitudes')
    grupo = models.ForeignKey(GrupoEntrenamiento, on_delete=models.SET_NULL, null=True, blank=True, related_name='solicitudes')
    alumno_nombres = models.CharField(max_length=100)
    alumno_apellidos = models.CharField(max_length=100)
    documento = models.CharField(max_length=30)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    tutor_nombre = models.CharField(max_length=160)
    tutor_telefono = models.CharField(max_length=25)
    tutor_email = models.EmailField(blank=True)
    observaciones = models.TextField(blank=True)
    estado = models.CharField(max_length=15, choices=Estados.choices, default=Estados.PENDIENTE)
    respuesta = models.TextField(blank=True)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    revisada_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    fecha_revision = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-fecha_solicitud']


class ListaEspera(models.Model):
    class Estados(models.TextChoices):
        ESPERANDO = 'ESPERANDO', 'Esperando'
        CONTACTADO = 'CONTACTADO', 'Contactado'
        INSCRITO = 'INSCRITO', 'Inscrito'
        CANCELADO = 'CANCELADO', 'Cancelado'

    categoria = models.ForeignKey(CategoriaEscuela, on_delete=models.PROTECT, related_name='lista_espera')
    grupo = models.ForeignKey(GrupoEntrenamiento, on_delete=models.SET_NULL, null=True, blank=True, related_name='lista_espera')
    solicitud = models.OneToOneField(SolicitudInscripcion, on_delete=models.SET_NULL, null=True, blank=True)
    alumno_nombre = models.CharField(max_length=200)
    tutor_nombre = models.CharField(max_length=160)
    tutor_telefono = models.CharField(max_length=25)
    estado = models.CharField(max_length=12, choices=Estados.choices, default=Estados.ESPERANDO)
    prioridad = models.PositiveIntegerField(default=1)
    observaciones = models.TextField(blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['prioridad', 'fecha_registro']


class GastoEscuela(models.Model):
    class Categorias(models.TextChoices):
        CANCHA = 'CANCHA', 'Alquiler de cancha'
        ENTRENADORES = 'ENTRENADORES', 'Pago a entrenadores'
        MATERIAL = 'MATERIAL', 'Material deportivo'
        UNIFORMES = 'UNIFORMES', 'Uniformes'
        SERVICIOS = 'SERVICIOS', 'Servicios'
        OTRO = 'OTRO', 'Otro'

    concepto = models.CharField(max_length=180)
    categoria = models.CharField(max_length=20, choices=Categorias.choices)
    monto = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    fecha = models.DateField(default=timezone.localdate)
    metodo = models.CharField(max_length=20, choices=Pago.Metodos.choices, default=Pago.Metodos.EFECTIVO)
    comprobante = models.FileField(upload_to='escuela/gastos/%Y/%m/', blank=True, null=True)
    observaciones = models.TextField(blank=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha', '-id']


class ProductoInventario(models.Model):
    class Tipos(models.TextChoices):
        UNIFORME = 'UNIFORME', 'Uniforme'
        MATERIAL = 'MATERIAL', 'Material deportivo'
        OTRO = 'OTRO', 'Otro'

    nombre = models.CharField(max_length=140)
    tipo = models.CharField(max_length=15, choices=Tipos.choices)
    talla = models.CharField(max_length=20, blank=True)
    stock = models.IntegerField(default=0)
    stock_minimo = models.PositiveIntegerField(default=0)
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['tipo', 'nombre', 'talla']
        constraints = [models.UniqueConstraint(fields=['nombre', 'talla'], name='producto_talla_unico')]


class MovimientoInventario(models.Model):
    class Tipos(models.TextChoices):
        ENTRADA = 'ENTRADA', 'Entrada'
        SALIDA = 'SALIDA', 'Salida'
        AJUSTE = 'AJUSTE', 'Ajuste'

    producto = models.ForeignKey(ProductoInventario, on_delete=models.PROTECT, related_name='movimientos')
    tipo = models.CharField(max_length=10, choices=Tipos.choices)
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    motivo = models.CharField(max_length=180)
    alumno = models.ForeignKey(Alumno, on_delete=models.SET_NULL, null=True, blank=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha']


class RegistroAuditoria(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    accion = models.CharField(max_length=20)
    modelo = models.CharField(max_length=80)
    objeto_id = models.CharField(max_length=40, blank=True)
    descripcion = models.TextField()
    datos = models.JSONField(default=dict, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha']
