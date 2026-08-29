from django.conf import settings
from django.db import models
from django.urls import reverse


class Torneo(models.Model):
    ESTADO_CHOICES = [
        ('PROGRAMADO', 'Programado'),
        ('EN_CURSO', 'En curso'),
        ('FINALIZADO', 'Finalizado'),
    ]

    nombre = models.CharField(max_length=200, verbose_name='Nombre del torneo')
    categoria = models.CharField(max_length=80, default='Senior', verbose_name='Categoría')
    fecha_inicio = models.DateField(verbose_name='Fecha de inicio')
    fecha_fin = models.DateField(verbose_name='Fecha de finalización')
    lugar = models.CharField(max_length=200, verbose_name='Lugar')
    descripcion = models.TextField(blank=True, verbose_name='Descripción')
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='PROGRAMADO',
        verbose_name='Estado',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_inicio']
        verbose_name = 'Torneo'
        verbose_name_plural = 'Torneos'

    def __str__(self):
        return self.nombre

    def get_absolute_url(self):
        return reverse('torneo_detalle', args=[self.pk])


class Equipo(models.Model):
    nombre = models.CharField(max_length=150, verbose_name='Nombre del equipo')
    categoria = models.CharField(max_length=80, default='Masculino', verbose_name='Categoría')
    color_principal = models.CharField(max_length=50, default='Rojo', verbose_name='Color principal')
    torneo = models.ForeignKey(Torneo, on_delete=models.CASCADE, related_name='equipos', verbose_name='Torneo')
    delegado = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name='equipos', verbose_name='Delegado', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Equipo'
        verbose_name_plural = 'Equipos'
        constraints = [
            models.UniqueConstraint(fields=['delegado', 'torneo'], name='unique_equipo_por_delegado_y_torneo'),
        ]

    def __str__(self):
        return self.nombre


class Jugador(models.Model):
    TIPO_PERSONA_CHOICES = [
        ('JUGADOR', 'Jugador'),
        ('ENTRENADOR', 'Entrenador'),
    ]

    POSICION_CHOICES = [
        ('LIBERO', 'Líbero'),
        ('PUNTA', 'Punta'),
        ('CENTRAL', 'Central'),
        ('OPUESTO', 'Opuesto'),
        ('COLOCADOR', 'Colocador'),
        ('REVANCHA', 'Revancha'),
    ]

    nombre = models.CharField(max_length=100, verbose_name='Nombre')
    apellido = models.CharField(max_length=100, verbose_name='Apellido')
    tipo_persona = models.CharField(max_length=20, choices=TIPO_PERSONA_CHOICES, default='JUGADOR', verbose_name='Tipo')
    documento = models.CharField(max_length=20, unique=True, verbose_name='Documento')
    fecha_nacimiento = models.DateField(verbose_name='Fecha de nacimiento')
    posicion = models.CharField(max_length=20, choices=POSICION_CHOICES, default='PUNTA', verbose_name='Posición')
    equipo = models.ForeignKey(Equipo, on_delete=models.CASCADE, related_name='jugadores', verbose_name='Equipo')
    torneo = models.ForeignKey(Torneo, on_delete=models.CASCADE, related_name='jugadores', verbose_name='Torneo')
    foto = models.ImageField(upload_to='jugadores/', blank=True, null=True, verbose_name='Foto')
    activo = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Jugador'
        verbose_name_plural = 'Jugadores'

    def __str__(self):
        return f'{self.nombre} {self.apellido}'

    @property
    def nombre_completo(self):
        return f'{self.nombre} {self.apellido}'


class Credencial(models.Model):
    TIPO_CHOICES = [
        ('JUGADOR', 'Jugador'),
        ('DELEGADO', 'Delegado'),
        ('ARBITRO', 'Árbitro'),
    ]

    torneo = models.ForeignKey(Torneo, on_delete=models.CASCADE, related_name='credenciales', verbose_name='Torneo')
    jugador = models.ForeignKey(Jugador, on_delete=models.CASCADE, related_name='credenciales', verbose_name='Jugador', blank=True, null=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='JUGADOR', verbose_name='Tipo')
    codigo = models.CharField(max_length=50, unique=True, verbose_name='Código')
    fecha_emision = models.DateTimeField(auto_now_add=True)
    observacion = models.TextField(blank=True, verbose_name='Observación')

    class Meta:
        verbose_name = 'Credencial'
        verbose_name_plural = 'Credenciales'

    def __str__(self):
        return f'{self.codigo} - {self.get_tipo_display()}'

    def save(self, *args, **kwargs):
        if not self.codigo:
            self.codigo = f"AYA-{self.torneo_id}-{self.jugador_id or 'GEN'}"
        super().save(*args, **kwargs)


class Partido(models.Model):
    ESTADO_CHOICES = [
        ('PROGRAMADO', 'Programado'),
        ('EN_CURSO', 'En curso'),
        ('FINALIZADO', 'Finalizado'),
        ('SUSPENDIDO', 'Suspendido'),
        ('CANCELADO', 'Cancelado'),
    ]

    torneo = models.ForeignKey(Torneo, on_delete=models.CASCADE, related_name='partidos', verbose_name='Torneo')
    equipo_local = models.ForeignKey(Equipo, on_delete=models.CASCADE, related_name='partidos_local', verbose_name='Equipo local')
    equipo_visitante = models.ForeignKey(Equipo, on_delete=models.CASCADE, related_name='partidos_visitante', verbose_name='Equipo visitante')
    fecha = models.DateField(verbose_name='Fecha')
    hora = models.TimeField(verbose_name='Hora')
    lugar = models.CharField(max_length=200, verbose_name='Lugar')
    ronda = models.PositiveIntegerField(default=1, verbose_name='Ronda')
    orden = models.PositiveIntegerField(default=1, verbose_name='Orden')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='PROGRAMADO', verbose_name='Estado')
    ganador = models.ForeignKey(Equipo, on_delete=models.SET_NULL, related_name='partidos_ganados', blank=True, null=True, verbose_name='Ganador')
    puntos_local = models.PositiveIntegerField(default=0, verbose_name='Puntos de tabla local')
    puntos_visitante = models.PositiveIntegerField(default=0, verbose_name='Puntos de tabla visitante')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['fecha', 'hora', 'orden']
        verbose_name = 'Partido'
        verbose_name_plural = 'Partidos'
        constraints = [
            models.UniqueConstraint(
                fields=['torneo', 'equipo_local', 'equipo_visitante'],
                name='unique_partido_por_cruce',
            ),
        ]

    def __str__(self):
        return f'{self.equipo_local} vs {self.equipo_visitante}'

    def actualizar_resultado(self):
        sets_local = self.sets.filter(puntos_local__gt=models.F('puntos_visitante')).count()
        sets_visitante = self.sets.filter(puntos_visitante__gt=models.F('puntos_local')).count()

        if sets_local == sets_visitante:
            self.ganador = None
            self.puntos_local = 0
            self.puntos_visitante = 0
            self.estado = 'PROGRAMADO'
        elif sets_local > sets_visitante:
            self.ganador = self.equipo_local
            self.puntos_local = 2
            self.puntos_visitante = 1
            self.estado = 'FINALIZADO'
        else:
            self.ganador = self.equipo_visitante
            self.puntos_local = 1
            self.puntos_visitante = 2
            self.estado = 'FINALIZADO'

        self.save(update_fields=['ganador', 'puntos_local', 'puntos_visitante', 'estado'])


class SetPartido(models.Model):
    partido = models.ForeignKey(Partido, on_delete=models.CASCADE, related_name='sets', verbose_name='Partido')
    numero = models.PositiveIntegerField(verbose_name='Numero de set')
    puntos_local = models.PositiveIntegerField(verbose_name='Puntos local')
    puntos_visitante = models.PositiveIntegerField(verbose_name='Puntos visitante')

    class Meta:
        ordering = ['numero']
        verbose_name = 'Set de partido'
        verbose_name_plural = 'Sets de partido'
        constraints = [
            models.UniqueConstraint(fields=['partido', 'numero'], name='unique_set_por_partido'),
        ]

    def __str__(self):
        return f'Set {self.numero}: {self.puntos_local}-{self.puntos_visitante}'
