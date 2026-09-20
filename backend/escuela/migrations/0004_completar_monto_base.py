from django.db import migrations
from django.db.models import F


def completar_monto_base(apps, schema_editor):
    Mensualidad = apps.get_model('escuela', 'Mensualidad')
    Mensualidad.objects.filter(monto_base=0).update(monto_base=F('monto'))


class Migration(migrations.Migration):
    dependencies = [('escuela', '0003_mensualidad_descuento_aplicado_and_more')]
    operations = [migrations.RunPython(completar_monto_base, migrations.RunPython.noop)]
