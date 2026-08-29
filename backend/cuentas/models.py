from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UsuarioManager(BaseUserManager):
    """
    Manager personalizado para nuestro modelo de usuario.
    El inicio de sesión se realiza mediante username.
    """

    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError("El nombre de usuario es obligatorio.")

        user = self.model(
            username=username,
            **extra_fields
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("rol", "ADMIN")

        if extra_fields.get("is_staff") is not True:
            raise ValueError(
                "El superusuario debe tener is_staff=True."
            )

        if extra_fields.get("is_superuser") is not True:
            raise ValueError(
                "El superusuario debe tener is_superuser=True."
            )

        return self.create_user(
            username=username,
            password=password,
            **extra_fields
        )


class Usuario(AbstractUser):

    class Roles(models.TextChoices):
        ADMIN = "ADMIN", "Administrador"
        DELEGADO = "DELEGADO", "Delegado"
        ENTRENADOR = "ENTRENADOR", "Entrenador"

    email = models.EmailField(
        unique=True,
        verbose_name="Correo electrónico",
    )

    telefono = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="Teléfono",
    )

    rol = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.DELEGADO,
        verbose_name="Rol",
    )

    foto = models.ImageField(
        upload_to="usuarios/",
        blank=True,
        null=True,
        verbose_name="Foto",
    )

    fecha_registro = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de registro",
    )

    USERNAME_FIELD = "username"

    REQUIRED_FIELDS = ["email"]

    objects = UsuarioManager()

    def __str__(self):
        return f"{self.username} - {self.get_full_name()}"
