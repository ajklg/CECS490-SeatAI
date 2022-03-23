from django.shortcuts import render
from django.http import HttpResponse
from . import urls
from .models import Room

def showRoom(request):
    rooms = Room.objects.all()
    return render(request, 'Room_Status.html',{'rooms':rooms})

