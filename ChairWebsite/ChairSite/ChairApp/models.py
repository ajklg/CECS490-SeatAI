from django.db import models

class Room(models.Model):
    roomName = models.CharField(max_length=50)
    totalChairs = models.IntegerField('Total Chairs')
    occupiedChairs = models.IntegerField('Occupied Chairs')
