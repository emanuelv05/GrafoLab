from django.contrib import admin
from .models import Attempt, Exercise


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ("title", "semester", "category", "kind", "is_published", "created_at")
    list_filter = ("semester", "category", "kind", "is_published")
    search_fields = ("title", "statement")
    exclude = ("created_by",)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ("student", "exercise", "is_correct", "created_at")
    list_filter = ("is_correct", "exercise")
    readonly_fields = ("exercise", "student", "answer", "is_correct", "feedback", "created_at")

    def has_add_permission(self, request):
        return False