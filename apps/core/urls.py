from django.urls import path
from . import views

app_name = "core"

urlpatterns = [
    path("", views.DashboardView.as_view(), name="dashboard"),

    path("semesters/", views.SemesterListView.as_view(), name="semester_list"),
    path("semesters/new/", views.SemesterCreateView.as_view(), name="semester_create"),
    path("semesters/<int:pk>/", views.SemesterDetailView.as_view(), name="semester_detail"),
    path("semesters/<int:pk>/edit/", views.SemesterUpdateView.as_view(), name="semester_update"),
    path("semesters/<int:pk>/delete/", views.SemesterDeleteView.as_view(), name="semester_delete"),
    path("semesters/<int:pk>/enroll/", views.SemesterEnrollView.as_view(), name="semester_enroll"),
    path("semesters/<int:pk>/remove/<int:student_pk>/", views.SemesterRemoveStudentView.as_view(), name="semester_remove_student"),
]