from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('torneos', '0004_equipo_delegado_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='equipo',
            name='logo_data_url',
            field=models.TextField(blank=True, default='', verbose_name='Logo comprimido'),
        ),
        migrations.AddField(
            model_name='jugador',
            name='foto_data_url',
            field=models.TextField(blank=True, default='', verbose_name='Foto comprimida'),
        ),
    ]
