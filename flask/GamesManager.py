from flask import request, jsonify
from webapp import app
import webapp
import json
from os import path
print('Game manager is online')

gameConfigs = {}
with open(path.join(path.dirname(__file__), 'backend_game_files/gameconfigs.json')) as f:
    gameConfigs = json.load(f)

def GetRoster(mapType):
    return gameConfigs[mapType]["roster"].copy()

class GameSession:
    def __init__(self, gameSettings):
        self.gameSettings = gameSettings
        self.gameSettings["remaining"] = GetRoster(self.gameSettings["mapType"])
        self.participants = {}
    def GetAvailableNations(self):
        return self.gameSettings["remaining"]
    def AddParticipant(self, participantData):
        try:
            if participantData["passwordSupplied"] == self.gameSettings.lobbyPassword:
                return -1
        except:
            pass
        if participantData["nation"] in self.gameSettings["remaining"]:
            self.participants[participantData["nation"]] = participantData["data"]
            self.gameSettings["remaining"].remove(participantData["data"])
            return len(self.gameSettings["remaining"])
        else:
            return -2
gamesForBrowsepage = []
gamesInSession = {}


@app.route('/game-check/<gameName>')
def CheckGameExistence(gameName):
    if(gameName in gamesInSession):
        return '', 204
    else:
        return '', 201
@app.route('/game-create', methods=['POST'])
def CreateGame():
    body = request.get_json()
    print(body)
    gamesForBrowsepage.append(body["gameName"])
    gamesInSession[body["gameName"]] = GameSession(body["gameSettings"])
    gamesInSession[body["gameName"]].AddParticipant(body["participantData"])
    return 'game ' + body["gameName"] + ' created'
@app.route('/clientDeliver', methods=['POST'])
def RecieveCommand():
    print(request.get_json())
    return 'hi'
