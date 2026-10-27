from django.contrib import admin
from .models import Semester


@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")
    list_filter = ("is_active",)
    filter_horizontal = ("students",)