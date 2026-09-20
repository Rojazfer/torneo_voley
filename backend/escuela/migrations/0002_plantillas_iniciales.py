from django.db import migrations


def crear_plantillas(apps, schema_editor):
    PlantillaMensaje = apps.get_model('escuela', 'PlantillaMensaje')
    plantillas = [
        {
            'nombre': 'Recordatorio antes del vencimiento',
            'tipo': 'RECORDATORIO',
            'contenido': 'Hola {tutor}, le recordamos que la mensualidad de {alumno}, categoria {categoria}, vence el {vencimiento}. El saldo es de Bs {saldo}. Muchas gracias.',
        },
        {
            'nombre': 'Aviso de mensualidad vencida',
            'tipo': 'DEUDA',
            'contenido': 'Hola {tutor}, la mensualidad de {alumno} correspondiente a {periodo} se encuentra pendiente. El saldo es de Bs {saldo} y vencio el {vencimiento}. Agradecemos regularizar el pago.',
        },
        {
            'nombre': 'Confirmacion de pago',
            'tipo': 'CONFIRMACION',
            'contenido': 'Hola {tutor}, confirmamos el pago de la mensualidad de {alumno}, categoria {categoria}, correspondiente a {periodo}. Muchas gracias.',
        },
    ]
    for datos in plantillas:
        PlantillaMensaje.objects.get_or_create(nombre=datos['nombre'], defaults=datos)


def eliminar_plantillas(apps, schema_editor):
    PlantillaMensaje = apps.get_model('escuela', 'PlantillaMensaje')
    PlantillaMensaje.objects.filter(nombre__in=[
        'Recordatorio antes del vencimiento',
        'Aviso de mensualidad vencida',
        'Confirmacion de pago',
    ]).delete()


class Migration(migrations.Migration):
    dependencies = [('escuela', '0001_initial')]
    operations = [migrations.RunPython(crear_plantillas, eliminar_plantillas)]
