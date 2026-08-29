# Generated manually because the local Python executable is not accessible in this workspace.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('torneos', '0002_jugador_tipo_persona'),
    ]

    operations = [
        migrations.CreateModel(
            name='Partido',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha', models.DateField(verbose_name='Fecha')),
                ('hora', models.TimeField(verbose_name='Hora')),
                ('lugar', models.CharField(max_length=200, verbose_name='Lugar')),
                ('ronda', models.PositiveIntegerField(default=1, verbose_name='Ronda')),
                ('orden', models.PositiveIntegerField(default=1, verbose_name='Orden')),
                ('estado', models.CharField(choices=[('PROGRAMADO', 'Programado'), ('EN_CURSO', 'En curso'), ('FINALIZADO', 'Finalizado'), ('SUSPENDIDO', 'Suspendido'), ('CANCELADO', 'Cancelado')], default='PROGRAMADO', max_length=20, verbose_name='Estado')),
                ('puntos_local', models.PositiveIntegerField(default=0, verbose_name='Puntos de tabla local')),
                ('puntos_visitante', models.PositiveIntegerField(default=0, verbose_name='Puntos de tabla visitante')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('equipo_local', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='partidos_local', to='torneos.equipo', verbose_name='Equipo local')),
                ('equipo_visitante', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='partidos_visitante', to='torneos.equipo', verbose_name='Equipo visitante')),
                ('ganador', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='partidos_ganados', to='torneos.equipo', verbose_name='Ganador')),
                ('torneo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='partidos', to='torneos.torneo', verbose_name='Torneo')),
            ],
            options={
                'verbose_name': 'Partido',
                'verbose_name_plural': 'Partidos',
                'ordering': ['fecha', 'hora', 'orden'],
            },
        ),
        migrations.CreateModel(
            name='SetPartido',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.PositiveIntegerField(verbose_name='Numero de set')),
                ('puntos_local', models.PositiveIntegerField(verbose_name='Puntos local')),
                ('puntos_visitante', models.PositiveIntegerField(verbose_name='Puntos visitante')),
                ('partido', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sets', to='torneos.partido', verbose_name='Partido')),
            ],
            options={
                'verbose_name': 'Set de partido',
                'verbose_name_plural': 'Sets de partido',
                'ordering': ['numero'],
            },
        ),
        migrations.AddConstraint(
            model_name='partido',
            constraint=models.UniqueConstraint(fields=('torneo', 'equipo_local', 'equipo_visitante'), name='unique_partido_por_cruce'),
        ),
        migrations.AddConstraint(
            model_name='setpartido',
            constraint=models.UniqueConstraint(fields=('partido', 'numero'), name='unique_set_por_partido'),
        ),
    ]
