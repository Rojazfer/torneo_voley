from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .api_views import DashboardStatsAPIView, UserDetailAPIView, UserListCreateAPIView, UserMeAPIView, UserRegisterAPIView

urlpatterns = [
    # JWT
    path('auth/login/', TokenObtainPairView.as_view(), name='api_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api_refresh'),
    
    # Usuarios
    path('auth/register/', UserRegisterAPIView.as_view(), name='api_register'),
    path('auth/me/', UserMeAPIView.as_view(), name='api_me'),
    path('usuarios/', UserListCreateAPIView.as_view(), name='api_usuarios'),
    path('usuarios/<int:pk>/', UserDetailAPIView.as_view(), name='api_usuario_detail'),
    
    # Dashboard
    path('dashboard/', DashboardStatsAPIView.as_view(), name='api_dashboard'),
]
