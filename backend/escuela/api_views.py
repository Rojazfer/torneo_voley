import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Alumno, CambioHorarioGrupo, CategoriaEscuela, DescuentoAlumno, DocumentoAlumno, EntregaUniforme, EvaluacionDeportiva,
    FichaMedica, GastoEscuela, GrupoEntrenamiento, ListaEspera, Mensualidad,
    MovimientoInventario, Pago, PlantillaMensaje, PrestamoMaterial,
    ProductoInventario, RegistroAuditoria, RegistroMensaje, SolicitudInscripcion,
)
from .serializers import (
    AlumnoSerializer, CambioHorarioGrupoSerializer, CategoriaEscuelaSerializer, DescuentoAlumnoSerializer, DocumentoAlumnoSerializer,
    EntregaUniformeSerializer, EvaluacionDeportivaSerializer, FichaMedicaSerializer,
    GastoEscuelaSerializer,
    GenerarMensualidadesSerializer, GrupoEntrenamientoSerializer, MensualidadSerializer,
    ListaEsperaSerializer, MovimientoInventarioSerializer, PagoSerializer,
    PlantillaMensajeSerializer, PrestamoMaterialSerializer, ProductoInventarioSerializer,
    RegistroAuditoriaSerializer, RegistroMensajeSerializer, SolicitudInscripcionSerializer,
    SolicitudRevisionSerializer,
)


def es_admin(user):
    return getattr(user, 'rol', '') == 'ADMIN'


def es_entrenador(user):
    return getattr(user, 'rol', '') == 'ENTRENADOR'


class EsUsuarioEscuela(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (es_admin(request.user) or es_entrenador(request.user)))


class SoloAdminOConsulta(EsUsuarioEscuela):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in permissions.SAFE_METHODS or es_admin(request.user)


class SoloAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and es_admin(request.user))


def categorias_visibles(user):
    queryset = CategoriaEscuela.objects.annotate(total_alumnos=Count('alumnos', filter=Q(alumnos__estado='ACTIVO')))
    if es_entrenador(user):
        queryset = queryset.filter(Q(entrenadores=user) | Q(alumnos__entrenador=user)).distinct()
    return queryset


def alumnos_visibles(user):
    queryset = Alumno.objects.select_related('categoria', 'entrenador').prefetch_related('mensualidades__pagos')
    if es_entrenador(user):
        queryset = queryset.filter(Q(entrenador=user) | Q(categoria__entrenadores=user)).distinct()
    return queryset


def mensualidades_visibles(user):
    queryset = Mensualidad.objects.select_related('alumno', 'alumno__categoria').prefetch_related('pagos')
    if es_entrenador(user):
        queryset = queryset.filter(Q(alumno__entrenador=user) | Q(alumno__categoria__entrenadores=user)).distinct()
    return queryset


class CategoriaListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = CategoriaEscuelaSerializer
    permission_classes = [SoloAdminOConsulta]

    def get_queryset(self):
        return categorias_visibles(self.request.user)


class CategoriaDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategoriaEscuelaSerializer
    permission_classes = [SoloAdminOConsulta]

    def get_queryset(self):
        return categorias_visibles(self.request.user)


class AlumnoListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = AlumnoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        queryset = alumnos_visibles(self.request.user)
        categoria = self.request.query_params.get('categoria')
        estado_alumno = self.request.query_params.get('estado')
        buscar = self.request.query_params.get('buscar')
        if categoria:
            queryset = queryset.filter(categoria_id=categoria)
        if estado_alumno:
            queryset = queryset.filter(estado=estado_alumno)
        if buscar:
            queryset = queryset.filter(Q(nombres__icontains=buscar) | Q(apellidos__icontains=buscar) | Q(documento__icontains=buscar))
        return queryset

    def perform_create(self, serializer):
        if es_entrenador(self.request.user):
            categoria = serializer.validated_data['categoria']
            if not categoria.entrenadores.filter(pk=self.request.user.pk).exists():
                raise PermissionDenied('Solo puedes registrar alumnos en tus categorias asignadas.')
            alumno = serializer.save(creado_por=self.request.user, entrenador=self.request.user)
            registrar_auditoria(self.request, 'CREAR', alumno, f'Alumno registrado: {alumno}')
            return
        alumno = serializer.save(creado_por=self.request.user)
        registrar_auditoria(self.request, 'CREAR', alumno, f'Alumno registrado: {alumno}')


class AlumnoDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AlumnoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return alumnos_visibles(self.request.user)

    def perform_update(self, serializer):
        if es_entrenador(self.request.user):
            categoria = serializer.validated_data.get('categoria', serializer.instance.categoria)
            if not categoria.entrenadores.filter(pk=self.request.user.pk).exists():
                raise PermissionDenied('Solo puedes mover alumnos entre tus categorias asignadas.')
            alumno = serializer.save(entrenador=self.request.user)
            registrar_auditoria(self.request, 'ACTUALIZAR', alumno, f'Alumno actualizado: {alumno}')
            return
        alumno = serializer.save()
        registrar_auditoria(self.request, 'ACTUALIZAR', alumno, f'Alumno actualizado: {alumno}')


class MensualidadListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = MensualidadSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        queryset = mensualidades_visibles(self.request.user)
        periodo = self.request.query_params.get('periodo')
        estado_cobro = self.request.query_params.get('estado')
        categoria = self.request.query_params.get('categoria')
        if periodo:
            queryset = queryset.filter(periodo__startswith=periodo)
        if estado_cobro == 'VENCIDA':
            queryset = queryset.filter(fecha_vencimiento__lt=date.today()).exclude(estado__in=['PAGADA', 'ANULADA'])
        elif estado_cobro:
            queryset = queryset.filter(estado=estado_cobro)
        if categoria:
            queryset = queryset.filter(alumno__categoria_id=categoria)
        return queryset

    def perform_create(self, serializer):
        alumno = serializer.validated_data['alumno']
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes crear cobros para este alumno.')
        serializer.save(creada_por=self.request.user)


class MensualidadDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MensualidadSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return mensualidades_visibles(self.request.user)


class GenerarMensualidadesAPIView(APIView):
    permission_classes = [EsUsuarioEscuela]

    def post(self, request):
        serializer = GenerarMensualidadesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        periodo = serializer.validated_data['periodo']
        categoria = serializer.validated_data.get('categoria')
        alumnos = alumnos_visibles(request.user).filter(estado=Alumno.Estados.ACTIVO)
        if categoria:
            alumnos = alumnos.filter(categoria=categoria)

        creadas = 0
        existentes = 0
        with transaction.atomic():
            for alumno in alumnos:
                ultimo_dia = calendar.monthrange(periodo.year, periodo.month)[1]
                dia = min(alumno.categoria.dia_vencimiento, ultimo_dia)
                fin_periodo = date(periodo.year, periodo.month, ultimo_dia)
                descuentos = alumno.descuentos.filter(
                    activo=True,
                    fecha_inicio__lte=fin_periodo,
                ).filter(Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=periodo))
                monto_base = alumno.monto_mensual
                porcentaje = min(sum((item.valor for item in descuentos if item.tipo == 'PORCENTAJE'), Decimal('0.00')), Decimal('100.00'))
                monto_fijo = sum((item.valor for item in descuentos if item.tipo == 'MONTO'), Decimal('0.00'))
                descuento = min(monto_base, (monto_base * porcentaje / Decimal('100.00')) + monto_fijo).quantize(Decimal('0.01'))
                detalle = ', '.join(f'{item.nombre}: {item.valor}{"%" if item.tipo == "PORCENTAJE" else " Bs"}' for item in descuentos)
                _, created = Mensualidad.objects.get_or_create(
                    alumno=alumno,
                    periodo=periodo,
                    defaults={
                        'monto_base': monto_base,
                        'descuento_aplicado': descuento,
                        'detalle_descuento': detalle,
                        'monto': monto_base - descuento,
                        'estado': Mensualidad.Estados.PAGADA if monto_base - descuento == 0 else Mensualidad.Estados.PENDIENTE,
                        'fecha_vencimiento': date(periodo.year, periodo.month, dia),
                        'creada_por': request.user,
                    },
                )
                creadas += int(created)
                existentes += int(not created)
        return Response({'creadas': creadas, 'existentes': existentes}, status=status.HTTP_201_CREATED)


class PagoListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = PagoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        queryset = Pago.objects.select_related('mensualidad', 'mensualidad__alumno', 'registrado_por')
        mensualidades = mensualidades_visibles(self.request.user).values_list('id', flat=True)
        return queryset.filter(mensualidad_id__in=mensualidades)

    def perform_create(self, serializer):
        mensualidad = serializer.validated_data['mensualidad']
        if not mensualidades_visibles(self.request.user).filter(pk=mensualidad.pk).exists():
            raise PermissionDenied('No puedes registrar pagos para este alumno.')
        pago = serializer.save(registrado_por=self.request.user)
        pago.mensualidad.actualizar_estado()
        registrar_auditoria(self.request, 'PAGO', pago, f'Pago {pago.numero_recibo}', {'monto': str(pago.monto)})


class PagoDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PagoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        mensualidades = mensualidades_visibles(self.request.user).values_list('id', flat=True)
        return Pago.objects.filter(mensualidad_id__in=mensualidades)

    def perform_update(self, serializer):
        mensualidad_anterior = serializer.instance.mensualidad
        pago = serializer.save()
        mensualidad_anterior.actualizar_estado()
        pago.mensualidad.actualizar_estado()

    def perform_destroy(self, instance):
        mensualidad = instance.mensualidad
        instance.delete()
        mensualidad.actualizar_estado()


class PlantillaListCreateAPIView(generics.ListCreateAPIView):
    queryset = PlantillaMensaje.objects.all()
    serializer_class = PlantillaMensajeSerializer
    permission_classes = [SoloAdminOConsulta]

    def perform_create(self, serializer):
        serializer.save(creada_por=self.request.user)


class PlantillaDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PlantillaMensaje.objects.all()
    serializer_class = PlantillaMensajeSerializer
    permission_classes = [SoloAdminOConsulta]


class RegistroMensajeListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = RegistroMensajeSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        alumnos = alumnos_visibles(self.request.user).values_list('id', flat=True)
        return RegistroMensaje.objects.select_related('alumno', 'enviado_por').filter(alumno_id__in=alumnos)

    def perform_create(self, serializer):
        alumno = serializer.validated_data['alumno']
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes registrar mensajes para este alumno.')
        serializer.save(enviado_por=self.request.user)


class ResumenEscuelaAPIView(APIView):
    permission_classes = [EsUsuarioEscuela]

    def get(self, request):
        alumnos = alumnos_visibles(request.user)
        mensualidades = mensualidades_visibles(request.user).exclude(estado='ANULADA')
        pagos = Pago.objects.filter(mensualidad__in=mensualidades)
        total_facturado = mensualidades.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        total_cobrado = pagos.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        vencidas = mensualidades.filter(fecha_vencimiento__lt=date.today()).exclude(estado='PAGADA')
        return Response({
            'categorias_activas': categorias_visibles(request.user).filter(activa=True).count(),
            'alumnos_activos': alumnos.filter(estado='ACTIVO').count(),
            'mensualidades_vencidas': vencidas.count(),
            'total_facturado': total_facturado,
            'total_cobrado': total_cobrado,
            'saldo_pendiente': max(total_facturado - total_cobrado, Decimal('0.00')),
            'grupos_activos': GrupoEntrenamiento.objects.filter(activo=True).count(),
            'becas_activas': DescuentoAlumno.objects.filter(activo=True).count(),
        })


def relacionados_visibles(model, user, campo='alumno'):
    ids = alumnos_visibles(user).values_list('id', flat=True)
    return model.objects.filter(**{f'{campo}_id__in': ids})


class GrupoListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = GrupoEntrenamientoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        queryset = GrupoEntrenamiento.objects.select_related('categoria', 'entrenador').prefetch_related('alumnos')
        if es_entrenador(self.request.user):
            queryset = queryset.filter(Q(entrenador=self.request.user) | Q(categoria__entrenadores=self.request.user)).distinct()
        return queryset

    def perform_create(self, serializer):
        categoria = serializer.validated_data['categoria']
        if es_entrenador(self.request.user) and not categoria.entrenadores.filter(pk=self.request.user.pk).exists():
            raise PermissionDenied('Solo puedes crear grupos en tus categorias asignadas.')
        serializer.save(entrenador=self.request.user if es_entrenador(self.request.user) else serializer.validated_data.get('entrenador'))


class GrupoDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = GrupoEntrenamientoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        queryset = GrupoEntrenamiento.objects.select_related('categoria', 'entrenador').prefetch_related('alumnos')
        if es_entrenador(self.request.user):
            queryset = queryset.filter(Q(entrenador=self.request.user) | Q(categoria__entrenadores=self.request.user)).distinct()
        return queryset

    def perform_update(self, serializer):
        categoria = serializer.validated_data.get('categoria', serializer.instance.categoria)
        if es_entrenador(self.request.user) and not categoria.entrenadores.filter(pk=self.request.user.pk).exists():
            raise PermissionDenied('Solo puedes administrar grupos de tus categorias.')
        serializer.save(entrenador=self.request.user if es_entrenador(self.request.user) else serializer.validated_data.get('entrenador', serializer.instance.entrenador))


class CambioHorarioListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = CambioHorarioGrupoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        queryset = CambioHorarioGrupo.objects.select_related('grupo', 'grupo__categoria', 'creado_por')
        if es_entrenador(self.request.user):
            queryset = queryset.filter(Q(grupo__entrenador=self.request.user) | Q(grupo__categoria__entrenadores=self.request.user)).distinct()
        return queryset

    def perform_create(self, serializer):
        grupo = serializer.validated_data['grupo']
        if es_entrenador(self.request.user) and not (
            grupo.entrenador_id == self.request.user.id
            or grupo.categoria.entrenadores.filter(pk=self.request.user.pk).exists()
        ):
            raise PermissionDenied('No puedes cambiar el horario de este grupo.')
        serializer.save(creado_por=self.request.user)


class CambioHorarioDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CambioHorarioGrupoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        queryset = CambioHorarioGrupo.objects.select_related('grupo', 'grupo__categoria')
        if es_entrenador(self.request.user):
            queryset = queryset.filter(Q(grupo__entrenador=self.request.user) | Q(grupo__categoria__entrenadores=self.request.user)).distinct()
        return queryset


class DescuentoListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = DescuentoAlumnoSerializer
    permission_classes = [SoloAdminOConsulta]

    def get_queryset(self):
        return relacionados_visibles(DescuentoAlumno, self.request.user).select_related('alumno')

    def perform_create(self, serializer):
        serializer.save(autorizado_por=self.request.user)


class DescuentoDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DescuentoAlumnoSerializer
    permission_classes = [SoloAdminOConsulta]

    def get_queryset(self):
        return relacionados_visibles(DescuentoAlumno, self.request.user)


class EvaluacionListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = EvaluacionDeportivaSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(EvaluacionDeportiva, self.request.user).select_related('alumno', 'alumno__categoria', 'evaluado_por')

    def perform_create(self, serializer):
        alumno = serializer.validated_data['alumno']
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes evaluar a este alumno.')
        serializer.save(evaluado_por=self.request.user)


class EvaluacionDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EvaluacionDeportivaSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(EvaluacionDeportiva, self.request.user)

    def perform_update(self, serializer):
        alumno = serializer.validated_data.get('alumno', serializer.instance.alumno)
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes evaluar a este alumno.')
        serializer.save(evaluado_por=self.request.user)


class FichaMedicaListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = FichaMedicaSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(FichaMedica, self.request.user).select_related('alumno', 'alumno__categoria')

    def perform_create(self, serializer):
        alumno = serializer.validated_data['alumno']
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes administrar la ficha de este alumno.')
        serializer.save(actualizado_por=self.request.user)


class FichaMedicaDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FichaMedicaSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(FichaMedica, self.request.user)

    def perform_update(self, serializer):
        alumno = serializer.validated_data.get('alumno', serializer.instance.alumno)
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes administrar la ficha de este alumno.')
        serializer.save(actualizado_por=self.request.user)


class DocumentoListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = DocumentoAlumnoSerializer
    permission_classes = [EsUsuarioEscuela]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return relacionados_visibles(DocumentoAlumno, self.request.user).select_related('alumno', 'subido_por')

    def perform_create(self, serializer):
        alumno = serializer.validated_data['alumno']
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes adjuntar documentos a este alumno.')
        serializer.save(subido_por=self.request.user)


class DocumentoDetailAPIView(generics.RetrieveDestroyAPIView):
    serializer_class = DocumentoAlumnoSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(DocumentoAlumno, self.request.user)


class UniformeListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = EntregaUniformeSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(EntregaUniforme, self.request.user).select_related('alumno')

    def perform_create(self, serializer):
        alumno = serializer.validated_data['alumno']
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes registrar uniformes para este alumno.')
        serializer.save(registrado_por=self.request.user)


class UniformeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EntregaUniformeSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(EntregaUniforme, self.request.user)

    def perform_update(self, serializer):
        alumno = serializer.validated_data.get('alumno', serializer.instance.alumno)
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes administrar uniformes de este alumno.')
        serializer.save()


class MaterialListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = PrestamoMaterialSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(PrestamoMaterial, self.request.user).select_related('alumno')

    def perform_create(self, serializer):
        alumno = serializer.validated_data['alumno']
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes prestar materiales a este alumno.')
        serializer.save(registrado_por=self.request.user)


class MaterialDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PrestamoMaterialSerializer
    permission_classes = [EsUsuarioEscuela]

    def get_queryset(self):
        return relacionados_visibles(PrestamoMaterial, self.request.user)

    def perform_update(self, serializer):
        alumno = serializer.validated_data.get('alumno', serializer.instance.alumno)
        if not alumnos_visibles(self.request.user).filter(pk=alumno.pk).exists():
            raise PermissionDenied('No puedes administrar materiales de este alumno.')
        serializer.save()


class ReportesEscuelaAPIView(APIView):
    permission_classes = [EsUsuarioEscuela]

    def get(self, request):
        alumnos = list(alumnos_visibles(request.user))
        mensualidades = mensualidades_visibles(request.user).exclude(estado='ANULADA')
        pagos = Pago.objects.filter(mensualidad__in=mensualidades)
        categorias = []
        for categoria in categorias_visibles(request.user):
            alumnos_categoria = [a for a in alumnos if a.categoria_id == categoria.id]
            categorias.append({
                'categoria': categoria.nombre,
                'alumnos': len(alumnos_categoria),
                'activos': sum(1 for a in alumnos_categoria if a.estado == 'ACTIVO'),
                'facturado': mensualidades.filter(alumno__categoria=categoria).aggregate(total=Sum('monto'))['total'] or 0,
                'cobrado': pagos.filter(mensualidad__alumno__categoria=categoria).aggregate(total=Sum('monto'))['total'] or 0,
            })
        por_metodo = list(pagos.values('metodo').annotate(total=Sum('monto'), operaciones=Count('id')).order_by('metodo'))
        caja_por_usuario = list(pagos.values(
            'registrado_por__username', 'registrado_por__first_name', 'registrado_por__last_name', 'metodo',
        ).annotate(total=Sum('monto'), operaciones=Count('id')).order_by('registrado_por__username', 'metodo'))
        por_mes = list(pagos.values('fecha_pago__year', 'fecha_pago__month').annotate(total=Sum('monto')).order_by('-fecha_pago__year', '-fecha_pago__month')[:12])
        desde = date.today() - timedelta(days=30)
        pagos_diarios = list(pagos.filter(fecha_pago__gte=desde).values('fecha_pago').annotate(
            total=Sum('monto'), operaciones=Count('id'),
        ).order_by('-fecha_pago'))
        inscripciones_por_mes = list(Alumno.objects.filter(pk__in=[a.pk for a in alumnos]).values(
            'fecha_inscripcion__year', 'fecha_inscripcion__month',
        ).annotate(total=Count('id')).order_by('-fecha_inscripcion__year', '-fecha_inscripcion__month')[:12])
        hoy = date.today()
        limite = hoy + timedelta(days=30)
        cumpleanos = []
        for alumno in alumnos:
            if not alumno.fecha_nacimiento:
                continue
            try:
                proximo = alumno.fecha_nacimiento.replace(year=hoy.year)
            except ValueError:
                proximo = alumno.fecha_nacimiento.replace(year=hoy.year, day=28)
            if proximo < hoy:
                try:
                    proximo = proximo.replace(year=hoy.year + 1)
                except ValueError:
                    proximo = proximo.replace(year=hoy.year + 1, day=28)
            if proximo <= limite:
                cumpleanos.append({'alumno': str(alumno), 'fecha': proximo, 'categoria': alumno.categoria.nombre})
        familias = {}
        for alumno in alumnos:
            telefono = alumno.tutor_telefono
            familia = familias.setdefault(telefono, {'tutor': alumno.tutor_nombre, 'telefono': telefono, 'alumnos': [], 'deuda': Decimal('0.00')})
            familia['alumnos'].append(str(alumno))
            familia['deuda'] += sum((m.saldo for m in alumno.mensualidades.all() if m.estado != 'ANULADA'), Decimal('0.00'))
        rangos = {'Menores de 8': 0, '8 a 10': 0, '11 a 13': 0, '14 a 17': 0, '18 o mas': 0, 'Sin fecha': 0}
        cumplimiento = {'al_dia': 0, 'con_deuda': 0, 'sin_cargos': 0}
        for alumno in alumnos:
            if alumno.fecha_nacimiento:
                edad = hoy.year - alumno.fecha_nacimiento.year - ((hoy.month, hoy.day) < (alumno.fecha_nacimiento.month, alumno.fecha_nacimiento.day))
                clave = 'Menores de 8' if edad < 8 else '8 a 10' if edad <= 10 else '11 a 13' if edad <= 13 else '14 a 17' if edad <= 17 else '18 o mas'
            else:
                clave = 'Sin fecha'
            rangos[clave] += 1
            cargos = [m for m in alumno.mensualidades.all() if m.estado != 'ANULADA']
            if not cargos:
                cumplimiento['sin_cargos'] += 1
            elif any(m.saldo > 0 for m in cargos):
                cumplimiento['con_deuda'] += 1
            else:
                cumplimiento['al_dia'] += 1
        return Response({
            'categorias': categorias,
            'pagos_por_metodo': por_metodo,
            'caja_por_usuario': caja_por_usuario,
            'ingresos_por_mes': por_mes,
            'pagos_diarios': pagos_diarios,
            'inscripciones_por_mes': inscripciones_por_mes,
            'cumpleanos': sorted(cumpleanos, key=lambda item: item['fecha']),
            'familias_con_deuda': sorted((f for f in familias.values() if f['deuda'] > 0), key=lambda item: item['deuda'], reverse=True),
            'uniformes_pendientes': relacionados_visibles(EntregaUniforme, request.user).filter(pagado=False).count(),
            'materiales_prestados': relacionados_visibles(PrestamoMaterial, request.user).filter(estado='PRESTADO').count(),
            'alumnos_por_estado': {
                'activos': sum(1 for a in alumnos if a.estado == 'ACTIVO'),
                'inactivos': sum(1 for a in alumnos if a.estado == 'INACTIVO'),
                'retirados': sum(1 for a in alumnos if a.estado == 'RETIRADO'),
            },
            'rangos_edad': [{'rango': clave, 'total': total} for clave, total in rangos.items()],
            'cumplimiento_pagos': cumplimiento,
        })


def registrar_auditoria(request, accion, objeto, descripcion, datos=None):
    RegistroAuditoria.objects.create(
        usuario=request.user if request.user.is_authenticated else None,
        accion=accion,
        modelo=objeto.__class__.__name__,
        objeto_id=str(getattr(objeto, 'pk', '')),
        descripcion=descripcion,
        datos=datos or {},
    )


class CatalogoInscripcionPublicaAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        categorias = CategoriaEscuela.objects.filter(activa=True).order_by('nombre')
        grupos = GrupoEntrenamiento.objects.filter(activo=True).select_related('categoria').prefetch_related('alumnos')
        return Response({
            'categorias': CategoriaEscuelaSerializer(categorias, many=True).data,
            'grupos': [
                {
                    'id': grupo.id,
                    'nombre': grupo.nombre,
                    'categoria': grupo.categoria_id,
                    'dias': grupo.dias,
                    'hora_inicio': grupo.hora_inicio,
                    'hora_fin': grupo.hora_fin,
                    'lugar': grupo.lugar,
                    'capacidad': grupo.capacidad,
                    'cupos_disponibles': max(grupo.capacidad - grupo.alumnos.count(), 0),
                }
                for grupo in grupos
            ],
        })


class SolicitudInscripcionListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = SolicitudInscripcionSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.AllowAny()]
        return [SoloAdmin()]

    def get_queryset(self):
        if not es_admin(self.request.user):
            raise PermissionDenied('Solo el administrador puede revisar solicitudes.')
        return SolicitudInscripcion.objects.select_related('categoria', 'grupo', 'revisada_por')

    def perform_create(self, serializer):
        documento = serializer.validated_data['documento']
        if Alumno.objects.filter(documento=documento).exists() or SolicitudInscripcion.objects.filter(documento=documento, estado='PENDIENTE').exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'documento': 'Ya existe un alumno o una solicitud pendiente con este documento.'})
        serializer.save()


class RevisarSolicitudAPIView(APIView):
    permission_classes = [SoloAdmin]

    @transaction.atomic
    def patch(self, request, pk):
        solicitud = get_object_or_404(SolicitudInscripcion.objects.select_for_update(), pk=pk)
        serializer = SolicitudRevisionSerializer(solicitud, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        nuevo_estado = serializer.validated_data.get('estado', solicitud.estado)
        if nuevo_estado == SolicitudInscripcion.Estados.APROBADA:
            grupo = solicitud.grupo
            if grupo and grupo.alumnos.count() >= grupo.capacidad:
                nuevo_estado = SolicitudInscripcion.Estados.LISTA_ESPERA
                ListaEspera.objects.get_or_create(
                    solicitud=solicitud,
                    defaults={
                        'categoria': solicitud.categoria,
                        'grupo': grupo,
                        'alumno_nombre': f'{solicitud.alumno_nombres} {solicitud.alumno_apellidos}',
                        'tutor_nombre': solicitud.tutor_nombre,
                        'tutor_telefono': solicitud.tutor_telefono,
                        'prioridad': ListaEspera.objects.filter(grupo=grupo, estado='ESPERANDO').count() + 1,
                    },
                )
            elif not Alumno.objects.filter(documento=solicitud.documento).exists():
                alumno = Alumno.objects.create(
                    categoria=solicitud.categoria,
                    entrenador=grupo.entrenador if grupo else None,
                    nombres=solicitud.alumno_nombres,
                    apellidos=solicitud.alumno_apellidos,
                    documento=solicitud.documento,
                    fecha_nacimiento=solicitud.fecha_nacimiento,
                    tutor_nombre=solicitud.tutor_nombre,
                    tutor_telefono=solicitud.tutor_telefono,
                    tutor_email=solicitud.tutor_email,
                    observaciones=solicitud.observaciones,
                    creado_por=request.user,
                )
                if grupo:
                    grupo.alumnos.add(alumno)
        solicitud.estado = nuevo_estado
        solicitud.respuesta = serializer.validated_data.get('respuesta', solicitud.respuesta)
        solicitud.revisada_por = request.user
        solicitud.fecha_revision = timezone.now()
        solicitud.save(update_fields=['estado', 'respuesta', 'revisada_por', 'fecha_revision'])
        registrar_auditoria(request, 'REVISAR', solicitud, f'Solicitud marcada como {nuevo_estado}')
        return Response(SolicitudInscripcionSerializer(solicitud).data)


class ListaEsperaListCreateAPIView(generics.ListCreateAPIView):
    queryset = ListaEspera.objects.select_related('categoria', 'grupo', 'solicitud')
    serializer_class = ListaEsperaSerializer
    permission_classes = [SoloAdmin]


class ListaEsperaDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ListaEspera.objects.all()
    serializer_class = ListaEsperaSerializer
    permission_classes = [SoloAdmin]

    def perform_update(self, serializer):
        registro = serializer.save()
        registrar_auditoria(self.request, 'ACTUALIZAR', registro, f'Lista de espera: {registro.estado}')


class GastoListCreateAPIView(generics.ListCreateAPIView):
    queryset = GastoEscuela.objects.select_related('registrado_por')
    serializer_class = GastoEscuelaSerializer
    permission_classes = [SoloAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        gasto = serializer.save(registrado_por=self.request.user)
        registrar_auditoria(self.request, 'CREAR', gasto, f'Gasto registrado: {gasto.concepto}', {'monto': str(gasto.monto)})


class GastoDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = GastoEscuela.objects.all()
    serializer_class = GastoEscuelaSerializer
    permission_classes = [SoloAdmin]


class ProductoInventarioListCreateAPIView(generics.ListCreateAPIView):
    queryset = ProductoInventario.objects.all()
    serializer_class = ProductoInventarioSerializer
    permission_classes = [SoloAdmin]

    def perform_create(self, serializer):
        producto = serializer.save()
        registrar_auditoria(self.request, 'CREAR', producto, f'Producto creado: {producto.nombre}')


class ProductoInventarioDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProductoInventario.objects.all()
    serializer_class = ProductoInventarioSerializer
    permission_classes = [SoloAdmin]


class MovimientoInventarioListCreateAPIView(generics.ListCreateAPIView):
    queryset = MovimientoInventario.objects.select_related('producto', 'alumno', 'registrado_por')
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [SoloAdmin]

    @transaction.atomic
    def perform_create(self, serializer):
        producto = ProductoInventario.objects.select_for_update().get(pk=serializer.validated_data['producto'].pk)
        tipo = serializer.validated_data['tipo']
        cantidad = serializer.validated_data['cantidad']
        if tipo == 'SALIDA' and producto.stock < cantidad:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'cantidad': 'No existe stock suficiente.'})
        producto.stock = cantidad if tipo == 'AJUSTE' else producto.stock + cantidad if tipo == 'ENTRADA' else producto.stock - cantidad
        producto.save(update_fields=['stock', 'fecha_actualizacion'])
        movimiento = serializer.save(producto=producto, registrado_por=self.request.user)
        registrar_auditoria(self.request, tipo, movimiento, f'{tipo} de {cantidad} unidades de {producto.nombre}', {'stock': producto.stock})


class AuditoriaListAPIView(generics.ListAPIView):
    queryset = RegistroAuditoria.objects.select_related('usuario')
    serializer_class = RegistroAuditoriaSerializer
    permission_classes = [SoloAdmin]


class PortalTutorAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'rol', '') != 'TUTOR':
            return Response({'detail': 'Solo tutores'}, status=status.HTTP_403_FORBIDDEN)
        alumnos = Alumno.objects.filter(tutor_usuario=request.user).select_related('categoria', 'entrenador').prefetch_related(
            'mensualidades__pagos', 'grupos', 'evaluaciones', 'documentos', 'uniformes', 'materiales_prestados',
        )
        data = []
        for alumno in alumnos:
            data.append({
                'alumno': AlumnoSerializer(alumno).data,
                'mensualidades': MensualidadSerializer(alumno.mensualidades.all(), many=True).data,
                'grupos': GrupoEntrenamientoSerializer(alumno.grupos.all(), many=True).data,
                'evaluaciones': EvaluacionDeportivaSerializer(alumno.evaluaciones.all()[:12], many=True).data,
                'documentos': DocumentoAlumnoSerializer(alumno.documentos.all(), many=True, context={'request': request}).data,
                'uniformes': EntregaUniformeSerializer(alumno.uniformes.all(), many=True).data,
                'materiales': PrestamoMaterialSerializer(alumno.materiales_prestados.all(), many=True).data,
            })
        return Response({'familia': data})
