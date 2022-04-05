from django.shortcuts import render
from django.http import HttpResponse
from . import urls
from .models import Room
from django.views.generic import TemplateView

class HomeView(TemplateView):

    def get(self, request):
        rooms = Room.objects.all()
        return render(request, 'home.html',{'rooms':rooms})

    def post(self, request):
        pass
