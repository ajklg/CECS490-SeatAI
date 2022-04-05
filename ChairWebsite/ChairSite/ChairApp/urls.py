from django.urls import path
from . import views
from ChairApp.views import ShowRooms, UpdateRooms
urlpatterns = [
    path('rooms/', ShowRooms.as_view(), name='rooms'),
    path('update/', UpdateRooms.as_view(), name='update'),
]