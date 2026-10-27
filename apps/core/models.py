from django.db import models
from django.conf import settings

# Create your models here.

# core/models.py
class Semester(models.Model):
    name = models.CharField(max_length=20, unique=True)  
    is_active = models.BooleanField(default=True)
    students = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="semesters", limit_choices_to={"role": "student"})

    class Meta:
        ordering = ["-name"]

    def __str__(self):
        return self.name