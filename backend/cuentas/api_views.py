from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from torneos.models import Equipo, Jugador, Partido, Torneo

from .serializers import CustomTokenObtainPairSerializer, UserRegisterSerializer, UserSerializer, UserUpdateSerializer

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vista personalizada para obtener tokens JWT.
    Utiliza el serializer personalizado.
    """
    serializer_class = CustomTokenObtainPairSerializer


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'rol', '') == 'ADMIN')


class UserMeAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserRegisterAPIView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if getattr(request.user, 'rol', '') != 'ADMIN':
            self.permission_denied(request, message='Solo administrador')


class UserListCreateAPIView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by('-fecha_registro')
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return UserSerializer
        return UserRegisterSerializer

    def check_permissions(self, request):
        super().check_permissions(request)
        if getattr(request.user, 'rol', '') != 'ADMIN':
            self.permission_denied(request, message='Solo administrador')


class UserDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if getattr(request.user, 'rol', '') != 'ADMIN':
            self.permission_denied(request, message='Solo administrador')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer


class DashboardStatsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'rol', '') != 'ADMIN':
            return Response({'detail': 'Solo administrador'}, status=status.HTTP_403_FORBIDDEN)

        data = {
            'total_torneos': Torneo.objects.count(),
            'total_equipos': Equipo.objects.count(),
            'total_jugadores': Jugador.objects.count(),
            'total_partidos': Partido.objects.count(),
            'total_usuarios': User.objects.count(),
            'torneos_activos': Torneo.objects.filter(estado='EN_CURSO').count(),
            'equipos_aprobados': Equipo.objects.count(),
        }
        return Response(data)
