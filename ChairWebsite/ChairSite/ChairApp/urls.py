from django.urls import path
from . import views
from ChairApp.views import HomeView
urlpatterns = [
    path('home/', HomeView.as_view(), name='get'),
]