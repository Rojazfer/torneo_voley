from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializer personalizado para obtener tokens JWT.
    Permite personalizar los datos que se devuelven junto con los tokens.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Agregamos datos adicionales del usuario al token
        token['username'] = user.username
        token['rol'] = getattr(user, 'rol', 'DELEGADO')
        token['email'] = user.email
        
        return token

    def validate(self, attrs):
        """
        Validar credenciales. SimpleJWT busca con 'username' por defecto.
        """
        data = super().validate(attrs)
        
        # Agregamos información del usuario a la respuesta
        user = self.user
        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'rol': getattr(user, 'rol', 'DELEGADO'),
        }
        
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'telefono',
            'rol',
            'foto',
            'fecha_registro',
        ]
        read_only_fields = ['id', 'fecha_registro']


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'password',
            'first_name',
            'last_name',
            'telefono',
            'rol',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'password',
            'first_name',
            'last_name',
            'telefono',
            'rol',
        ]

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance
