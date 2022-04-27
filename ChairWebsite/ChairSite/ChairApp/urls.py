from django.urls import path
from . import views
from django.views.decorators.csrf import csrf_exempt
from ChairApp.views import ShowRooms, sms
urlpatterns = [
    path('rooms/', ShowRooms.as_view(), name='rooms'),
    path('sms/', csrf_exempt(sms.as_view()), name='sms'),
]