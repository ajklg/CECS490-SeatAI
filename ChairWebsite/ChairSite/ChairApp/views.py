from django.shortcuts import render, redirect
from django.http import HttpResponse
from . import urls
from django.views.generic import TemplateView
from .models import Room
from .forms import updateOccupancyForm

class ShowRooms(TemplateView):
    def get(self, request):
        rooms = Room.objects.all()
        return render(request, 'rooms.html',{'rooms':rooms})

class UpdateRooms(TemplateView):
    def get(self, request):
        room = Room.objects.get(pk=1)
        form = updateOccupancyForm()
        return render(request, 'update.html', {'room':room, 'form':form})

    def post(self, request):
        room = Room.objects.get(pk=1)
        form = updateOccupancyForm(request.POST)
        if form.is_valid():
            room.occupiedChairs = form.cleaned_data['occupiedChairs']
            room.save()
        return redirect('update')
