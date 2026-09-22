from django.contrib import admin

from .models import (
    Alumno, CambioHorarioGrupo, CategoriaEscuela, DescuentoAlumno, DocumentoAlumno, EntregaUniforme, EntrenadorEscuela, EvaluacionDeportiva,
    FichaMedica, GastoEscuela, GrupoEntrenamiento, ListaEspera, Mensualidad,
    MovimientoInventario, Pago, PlantillaMensaje, PrestamoMaterial,
    ProductoInventario, RegistroAuditoria, RegistroMensaje, SolicitudInscripcion,
)


admin.site.register(CategoriaEscuela)
admin.site.register(EntrenadorEscuela)
admin.site.register(Alumno)
admin.site.register(Mensualidad)
admin.site.register(Pago)
admin.site.register(PlantillaMensaje)
admin.site.register(RegistroMensaje)
admin.site.register(GrupoEntrenamiento)
admin.site.register(DescuentoAlumno)
admin.site.register(EvaluacionDeportiva)
admin.site.register(FichaMedica)
admin.site.register(EntregaUniforme)
admin.site.register(PrestamoMaterial)
admin.site.register(DocumentoAlumno)
admin.site.register(CambioHorarioGrupo)
admin.site.register(SolicitudInscripcion)
admin.site.register(ListaEspera)
admin.site.register(GastoEscuela)
admin.site.register(ProductoInventario)
admin.site.register(MovimientoInventario)
admin.site.register(RegistroAuditoria)
