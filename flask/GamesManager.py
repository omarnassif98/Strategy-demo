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
        self.mapData['turnNumb'] = 0
        self.participants = {}
        self.TurnManager = {}
        

    def BeginGame(self):
        self.BeginNewTurn()

    def GetAvailableNations(self):
        return self.gameSettings["remaining"]

    def AddParticipant(self, participantData):
        if participantData["data"]['nation'] in self.gameSettings["remaining"]:
            self.participants[participantData["uid"]] = participantData["data"]
            self.gameSettings["remaining"].remove(participantData['data']["nation"])
            return len(self.gameSettings["remaining"])
        else:
            return -2
        
    
    def GetMapData(self):
        return self.mapData
    
    def BeginNewTurn(self):
        self.TurnManager = {"expectingFrom":list(self.participants.keys()), "QueuedMoves":{}}
        self.mapData['turnNumb'] += 1

    def QueueMove(self, uid, queuedMoves):
        nationTag = self.participants[uid]['nation']
        print('recieved moves for ' + nationTag)
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
                    if self.mapData['provinceInfo'][destProv]['troopPresence'] == True:
                        skirmishLedger[destProv]['defence'] = 1
                        print(destProv + ' has a troop')
                    else:
                         skirmishLedger[destProv]['defence'] = 0
                         print(destProv + ' has no troop presence')
                if self.TurnManager["QueuedMoves"][nationTag][fromProv]['moveType'] == 'attack':
                    skirmishLedger[destProv]['attacks'][nationTag]['fromProv'] = fromProv
                    skirmishLedger[destProv]['attacks'][nationTag]['strength'] += 1
                elif self.TurnManager["QueuedMoves"][nationTag][fromProv]['moveType'] == 'supportAtk':
                    supportAtkBuffer.append({'nationTag': nationTag, 'fromProv': fromProv, 'destProv': destProv, 'supporting': self.TurnManager["QueuedMoves"][nationTag][fromProv]['supporting']})
                else:
                    supportDefBuffer.append({'nationTag': nationTag, 'fromProv': fromProv, 'destProv': destProv})

        for support in supportAtkBuffer:
            destNation = self.mapData['provinceInfo'][support['destProv']]['owner']
            try:
                if support['fromProv'] in skirmishLedger.keys() and skirmishLedger[support['fromProv']]['attacks'][destNation]['fromProv'] != support['destProv']:
                    continue
                skirmishLedger[support['destProv']]['attacks'][support['supporting']]['strength'] += 1
            except:
                continue
        
        for support in supportDefBuffer:
            destNation = self.mapData['provinceInfo'][support['destProv']]['owner']
            try:
                if support['fromProv'] in skirmishLedger.keys() and skirmishLedger[support['fromProv']]['attacks'][destNation]['fromProv'] != support['destProv']:
                    continue
                print('defence of ' + nationTag + ' + 1')
                skirmishLedger[support['destProv']]['defence'] += 1
            except:
                continue
        print(skirmishLedger)
        
        
gamesForBrowsepage = []
gamesInSession = {}

@app.route('/gameList')
def ListGames():
    return json.dumps({'content': gamesForBrowsepage})

@app.route('/kickoff/<gameName>')
def KickGameOff(gameName):
    gamesInSession[gameName].BeginGame()
    return 'kicked off'

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
    gamesInSession[body["gameName"]] = GameSession(body["gameSettings"])
    gamesInSession[body["gameName"]].AddParticipant(body["participantData"])
    gamesForBrowsepage.append({'sessionName': body["gameName"], 'remaining': gamesInSession[body["gameName"]].GetAvailableNations(), 'host': body['participantData']['data']['username']})
    return '', 201

@app.route('/game-join', methods=['POST'])
def JoinGame():
    body = request.get_json()
    print(body)
    try:
        res = gamesInSession[body['sessionName']].AddParticipant(body['participantData'])
        if res < 0:
            return '', 204
        else:
            return '', 201
    except:
        return '', 204

@app.route('/game/<gameName>/data')
def GetGameMapData(gameName):
    return gamesInSession[gameName].GetMapData()

@app.route('/clientDeliver', methods=['POST'])
def RecieveCommand():
    body = request.get_json()
    print(body)
    if body['turn'] == gamesInSession[body['session']].mapData['turnNumb']:
        gamesInSession[body['session']].QueueMove(body['uid'], body['moves'])
        return '', 201
    else:
        return '', 204


def SendGameConfigs():
    return metaMaps

@app.route('/execute/<gameName>')
def Execute(gameName):
    gamesInSession[gameName].ExecuteQueuedMoves()
    return 'metaMaps'