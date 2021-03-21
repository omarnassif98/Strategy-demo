from flask import request, jsonify
from webapp import app
import webapp
import json
from os import path
print('Game manager is online')

def GetDataFromFile(fname):
    with open(path.join(path.dirname(__file__), 'backend_game_files/' + fname)) as f:
        return json.load(f)

metaMaps = GetDataFromFile('mapRosters.json')
def GetRoster(mapType):
    return metaMaps[mapType]["roster"].copy()

class GameSession:

    def __init__(self, gameSettings):
        self.gameSettings = gameSettings
        self.gameSettings["remaining"] = GetRoster(self.gameSettings["mapType"])
        self.mapData = GetDataFromFile('europa.json') 
        self.participants = {}
        self.TurnManager = {"turnNumb":0}
        

    def BeginGame(self):
        self.BeginNewTurn()

    def GetAvailableNations(self):
        return self.gameSettings["remaining"]

    def AddParticipant(self, participantData):
        try:
            if participantData["passwordSupplied"] == self.gameSettings.lobbyPassword:
                return -1
        except:
            pass
        if participantData["data"]['nation'] in self.gameSettings["remaining"]:
            self.participants[participantData["uid"]] = participantData["data"]
            self.gameSettings["remaining"].remove(participantData['data']["nation"])
            self.BeginGame() #TESTING ONLY
            return len(self.gameSettings["remaining"])
        else:
            return -2
        
    
    def GetMapData(self):
        return self.mapData
    
    def BeginNewTurn(self):
        self.TurnManager = {"turnNumb": self.TurnManager["turnNumb"] + 1, "expectingFrom":list(self.participants.keys()), "QueuedMoves":{}}

    def QueueMove(self, uid, queuedMoves):
        nationTag = self.participants[uid]['nation']
        self.TurnManager['QueuedMoves'][nationTag] = queuedMoves
        self.TurnManager["expectingFrom"].remove(uid)
        print(self.TurnManager)
    
    def ExecuteQueuedMoves(self):
        skirmishLedger = {}
        supportAtkBuffer = []
        supportDefBuffer = []
        for nationTag in self.TurnManager["QueuedMoves"]:
            for fromProv in self.TurnManager["QueuedMoves"][nationTag]:
                destProv = self.TurnManager["QueuedMoves"][nationTag][fromProv]['destProv']
                if destProv not in skirmishLedger:
                    skirmishLedger[destProv] = {'attacks':{nationTag:{'fromProv':None, 'strength':0}}}
                    skirmishLedger[destProv]['defence'] = 1 if self.mapData['provinceInfo'][destProv]['troopPresence'] == True else 0
                if self.TurnManager["QueuedMoves"][nationTag][fromProv]['moveType'] == 'attack':
                    skirmishLedger[destProv]['attacks'][nationTag]['fromProv'] = fromProv
                    skirmishLedger[destProv]['attacks'][nationTag]['strength'] += 1
                elif self.TurnManager["QueuedMoves"][nationTag][fromProv]['moveType'] == 'supportAtk':
                    supportAtkBuffer.append({'nationTag': nationTag, 'fromProv': fromProv, 'destProv': destProv, 'supporting': self.TurnManager["QueuedMoves"][nationTag][fromProv]['supporting']})
                else:
                    supportDefBuffer.append({'nationTag': nationTag, 'fromProv': fromProv, 'destProv': destProv})
        for defProv in skirmishLedger:
            if defProv not in self.TurnManager['QueuedMoves'][nationTag].keys() or self.TurnManager['QueuedMoves'][nationTag][defProv]['moveType'] != 'attack':
                skirmishLedger[defProv]['defence'] += 1
        for support in supportAtkBuffer:
            destNation = self.mapData['provinceInfo'][support['destProv']]['owner']
            if support['fromProv'] in skirmishLedger.keys() and skirmishLedger[support['fromProv']]['attacks'][destNation]['fromProv'] != support['destProv']:
                continue
            skirmishLedger[support['destProv']]['attacks'][support['supporting']]['strength'] += 1
        for support in supportDefBuffer:
            destNation = self.mapData['provinceInfo'][support['destProv']]['owner']
            if support['fromProv'] in skirmishLedger.keys() and skirmishLedger[support['fromProv']]['attacks'][destNation]['fromProv'] != support['destProv']:
                continue
            skirmishLedger[support['destProv']]['defence'] += 1
        print(skirmishLedger)
        print(supportAtkBuffer)
        print(supportDefBuffer)
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
    return '', 201

@app.route('/game/<gameName>/mapData')
def GetGameMapData(gameName):
    return gamesInSession[gameName].GetMapData()

@app.route('/clientDeliver', methods=['POST'])
def RecieveCommand():
    body = request.get_json()
    print(body)
    gamesInSession[body['session']].QueueMove(body['uid'], body['moves'])
    return '', 201

@app.route('/gameconfigs')
def SendGameConfigs():
    return metaMaps

@app.route('/execute/<gameName>')
def Execute(gameName):
    gamesInSession[gameName].ExecuteQueuedMoves()
    return 'metaMaps'