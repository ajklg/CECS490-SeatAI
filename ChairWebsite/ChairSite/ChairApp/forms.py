from django import forms
from django.forms import ModelForm
from .models import Room

class updateOccupancyForm(ModelForm):
    class Meta:
        model = Room
        fields = ('occupiedChairs',)
