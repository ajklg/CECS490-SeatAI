from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from . import urls
from django.views.generic import TemplateView
from .models import Room
from .forms import updateOccupancyForm
from twilio.twiml.messaging_response import MessagingResponse

class ShowRooms(TemplateView):
    def get(self, request):
        rooms = Room.objects.all()
        return render(request, 'rooms.html',{'rooms':rooms})

class sms(TemplateView):
    def post(self, request):
        room = Room.objects.get(pk=1)
        occupancy = request.POST.get('Body')
        if int(occupancy) <= room.totalChairs:
            room.occupiedChairs = int(occupancy)
            room.save()
        else:
            room.occupiedChairs = room.totalChairs
            room.save()
        return redirect('sms')

