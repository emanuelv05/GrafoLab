from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.

# Modelo user
class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrador (docente)"
        STUDENT = "student", "Estudiante"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT, db_column='id_role')

    # Comprobar si es admin
    @property
    def is_teacher(self):
        return self.role == self.Role.ADMIN

    # Comprobar si es estudiante
    @property
    def is_student(self):
        return self.role == self.Role.STUDENT

    def save(self, *args, **kwargs):
        # Todo superusuario es admin automáticamente
        if self.is_superuser:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)
