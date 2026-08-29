from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import render, redirect
from django.urls import reverse

from .forms import EquipoForm, JugadorForm, TorneoForm
from .models import Credencial, Equipo, Jugador, Torneo


@login_required
def dashboard(request):
    torneos = Torneo.objects.all().count()
    equipos = Equipo.objects.all().count()
    jugadores = Jugador.objects.all().count()
    credenciales = Credencial.objects.all().count()

    torneos_recientes = Torneo.objects.all()[:5]

    context = {
        'torneos': torneos,
        'equipos': equipos,
        'jugadores': jugadores,
        'credenciales': credenciales,
        'torneos_recientes': torneos_recientes,
    }
    return render(request, 'torneos/dashboard.html', context)


@login_required
def torneos_list(request):
    torneos = Torneo.objects.all()
    return render(request, 'torneos/torneos_list.html', {'torneos': torneos})


@login_required
def torneo_detalle(request, pk):
    torneo = Torneo.objects.get(pk=pk)
    equipos = torneo.equipos.all()
    jugadores = torneo.jugadores.all()
    credenciales = torneo.credenciales.all()
    return render(request, 'torneos/torneo_detalle.html', {
        'torneo': torneo,
        'equipos': equipos,
        'jugadores': jugadores,
        'credenciales': credenciales,
    })


@login_required
def torneo_nuevo(request):
    if request.method == 'POST':
        form = TorneoForm(request.POST)
        if form.is_valid():
            torneo = form.save()
            messages.success(request, f'Torneo {torneo.nombre} creado correctamente.')
            return redirect('torneos_list')
    else:
        form = TorneoForm()
    return render(request, 'torneos/torneo_form.html', {'form': form, 'titulo': 'Nuevo torneo'})


@login_required
def torneo_editar(request, pk):
    torneo = Torneo.objects.get(pk=pk)
    if request.method == 'POST':
        form = TorneoForm(request.POST, instance=torneo)
        if form.is_valid():
            form.save()
            messages.success(request, 'Torneo actualizado correctamente.')
            return redirect('torneo_detalle', pk=torneo.pk)
    else:
        form = TorneoForm(instance=torneo)
    return render(request, 'torneos/torneo_form.html', {'form': form, 'titulo': 'Editar torneo'})


@login_required
def equipos_list(request):
    equipos = Equipo.objects.select_related('torneo').all()
    return render(request, 'torneos/equipos_list.html', {'equipos': equipos})


@login_required
def equipo_nuevo(request, torneo_id=None):
    torneo = Torneo.objects.get(pk=torneo_id) if torneo_id else None
    if request.method == 'POST':
        form = EquipoForm(request.POST)
        if form.is_valid():
            equipo = form.save(commit=False)
            if torneo:
                equipo.torneo = torneo
            equipo.save()
            messages.success(request, 'Equipo registrado correctamente.')
            return redirect('equipos_list')
    else:
        form = EquipoForm()
    return render(request, 'torneos/equipo_form.html', {'form': form, 'titulo': 'Nuevo equipo'})


@login_required
def jugadores_list(request):
    jugadores = Jugador.objects.select_related('equipo', 'torneo').all()
    return render(request, 'torneos/jugadores_list.html', {'jugadores': jugadores})


@login_required
def jugador_nuevo(request):
    if request.method == 'POST':
        form = JugadorForm(request.POST, request.FILES)
        if form.is_valid():
            jugador = form.save(commit=False)
            jugador.torneo = jugador.equipo.torneo
            jugador.save()
            messages.success(request, 'Jugador registrado correctamente.')
            return redirect('jugadores_list')
    else:
        form = JugadorForm()
    return render(request, 'torneos/jugador_form.html', {'form': form, 'titulo': 'Nuevo jugador'})


@login_required
def credenciales_list(request):
    credenciales = Credencial.objects.select_related('torneo', 'jugador').all()
    return render(request, 'torneos/credenciales_list.html', {'credenciales': credenciales})


@login_required
def generar_credencial(request, jugador_id):
    jugador = Jugador.objects.get(pk=jugador_id)
    codigo = f"AYA-{jugador.torneo_id}-{jugador.id:04d}"
    credencial, created = Credencial.objects.get_or_create(
        torneo=jugador.torneo,
        jugador=jugador,
        defaults={'codigo': codigo, 'tipo': 'JUGADOR'}
    )
    if not created:
        credencial.codigo = codigo
        credencial.save()
    messages.success(request, 'Credencial generada correctamente.')
    return redirect('credenciales_list')


@login_required
def buscar(request):
    q = request.GET.get('q', '')
    resultados = []
    if q:
        resultados = (
            Jugador.objects.filter(
                Q(nombre__icontains=q) |
                Q(apellido__icontains=q) |
                Q(documento__icontains=q)
            )
            .select_related('equipo', 'torneo')
        )
    return render(request, 'torneos/buscar.html', {'q': q, 'resultados': resultados})
