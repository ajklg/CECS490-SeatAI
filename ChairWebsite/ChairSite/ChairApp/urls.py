from django.urls import path
from . import views
urlpatterns = [
    path('app/', views.showRoom, name='showRoom'),
]