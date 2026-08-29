# Generated manually because the local Python executable is isolated for this workspace.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('torneos', '0003_partido_setpartido'),
    ]

    operations = [
        migrations.AddField(
            model_name='equipo',
            name='delegado',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='equipos', to=settings.AUTH_USER_MODEL, verbose_name='Delegado'),
        ),
        migrations.AddConstraint(
            model_name='equipo',
            constraint=models.UniqueConstraint(fields=('delegado', 'torneo'), name='unique_equipo_por_delegado_y_torneo'),
        ),
    ]
