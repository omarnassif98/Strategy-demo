from flask import request
from flask_socketio import send, emit, join_room, leave_room
from webapp import socketApp

@socketApp.on('hook-game')
def roomJoin(data):
    from GameManager import gamesInSession
    join_room(data['room'])
    gamesInSession[data['room']].AttachSocketToUser(data['uid'], request.sid)
    print('welcome to ' + data['room'] + ', ' + request.sid)

@socketApp.on('sendMessage')
def sendMessage(data):
    from GameManager import gamesInSession
    print('client ' + request.sid + ' is messaging player ' + data['target'] + ' in room ' + data['room'])
    SendMessageToClient(data['message'], gamesInSession[data['room']].GetPlayerNation(data['uid']), gamesInSession[data['room']].GetNationSocket(data['target']))

@socketApp.on('broadcastMessage')
def broadcastToRoom(data):
    print('client ' + request.sid + ' has a message for room ' + data['room'])
    socketApp.emit('bcastMessage', {'message':data['message'], 'sender':gamesInSession[data['room']].GetPlayerNation(data['uid'])}, room=data['room'], include_self=False)

def SendMessageToClient(message, sender, sid):
    print(sender + ' says ' + message + ' to ' + sid)
    socketApp.emit('message', {'message':message, 'sender':sender}, to=sid)

def TriggerUpdate(updateType, room):
    socketApp.emit(updateType, room=room)