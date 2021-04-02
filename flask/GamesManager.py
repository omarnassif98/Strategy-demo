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

@app.route('/gameconfigs')
def GetRosters():
    return metaMaps

def GetRoster(mapType):
    return metaMaps[mapType]["roster"].copy()

class GameSession:

    def __init__(self, gameSettings):
        self.gameSettings = gameSettings
        self.gameSettings["remaining"] = GetRoster(self.gameSettings["mapType"])
        self.mapData = GetDataFromFile(gameSettings['mapType'] + '.json')
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
            print('Remaining:')
            print(self.gameSettings['remaining'])
            return -2
        
    def GetPlayerNation(self, uid):
        return self.participants[uid]['nation']
    
    def GetMapData(self):
        return self.mapData.copy()
    
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
        
        
        for prov in skirmishLedger:
            localSkirmishLedger = skirmishLedger[prov]
            defencePower = localSkirmishLedger['defence']
            maxStrength = [0, []]
            attacks = localSkirmishLedger['attacks']
            for attackingNation in attacks:
                attack = attacks[attackingNation]
                if attack['strength'] > maxStrength[0]:
                    maxStrength[1].clear()
                    maxStrength[0] = attack['strength']
                    print(attackingNation + ' is the greatest threat to ' + prov)
                    maxStrength[1].append(attackingNation)
                elif attack['strength'] == maxStrength[0]:
                    maxStrength[1].append(attackingNation)
            if maxStrength[0] > defencePower and len(maxStrength[1]) == 1:
                print('moving troop from ' + attacks[maxStrength[1][0]]['fromProv'] + ' to ' + prov)
                self.MoveTroop(attacks[maxStrength[1][0]]['fromProv'], prov)
        self.BeginNewTurn()



    def MoveTroop(self, fromProv, toProv):
        source = self.mapData['provinceInfo'][fromProv]
        destination = self.mapData['provinceInfo'][toProv]
        print('Source:')
        print(source)
        print('Dest:')
        print(destination)
        if destination['owner'] in self.mapData['nationInfo']:
            self.mapData['nationInfo'][destination['owner']]['provinces'].remove(toProv)
        destination['owner'] = source['owner']
        self.mapData['nationInfo'][source['owner']]['provinces'].append(toProv)
        source['troopPresence'] = False
        destination['troopPresence'] = True
        
        
gamesForBrowsepage = {}
gamesInSession = {}
playerSessions = {}
@app.route('/gameList')
def ListGames():
    return json.dumps(gamesForBrowsepage)

@app.route('/game-check/<gameName>')
def CheckGameExistence(gameName):
    if(gameName in gamesInSession):
        return 'exists', 204
    else:
        return 'does not exist', 201

@app.route('/game-create', methods=['POST'])
def CreateGame():
    body = request.get_json()
    print(body)
    if(body['gameName'] not in gamesInSession):
        gamesInSession[body["gameName"]] = GameSession(body["gameSettings"])
        gamesForBrowsepage[body["gameName"]] = {"host":body['participantData']['data']['username'], 'remaining':gamesInSession[body["gameName"]].gameSettings["remaining"]}
        AddPlayerToGame(body['gameName'], body['participantData'])
        return '', 201
    else:
        return '', 204

@app.route('/game-join', methods=['POST'])
def JoinGame():
    body = request.get_json()
    print(body)
    return AddPlayerToGame(body['gameName'], body['participantData'])
    

@app.route('/game/<gameName>/data', methods=['GET', 'POST'])
def GetGameMapData(gameName):
    response = gamesInSession[gameName].GetMapData()
    if request.method == 'POST':
        body = request.get_json()
        print(body)
        try:
            response['playingAs'] = gamesInSession[gameName].GetPlayerNation(body['uid'])
        except:
            print('oopsie whoopsie')
            pass
    return response

@app.route('/clientDeliver', methods=['POST'])
def RecieveCommand():
    body = request.get_json()
    print(body)
    if body['turn'] == gamesInSession[body['session']].mapData['turnNumb']:
        gamesInSession[body['session']].QueueMove(body['uid'], body['moves'])
        return '', 201
    else:
        return '', 204

@app.route('/<user>/get-games')
def GetUserGames(user):
    try:
        print(playerSessions)
        return json.dumps(playerSessions[user])
    except:
        return '', 204

@app.route('/game/<gameName>/advance')
def ExecuteNextTurn(gameName):
    gamesInSession[gameName].ExecuteQueuedMoves()
    return '', 201


def AddPlayerToGame(sessionName, data):
    uid = data['uid']
    if(uid not in playerSessions):
        playerSessions[uid] = {}
    try:
        playerSessions[uid][sessionName] = {'turnNumb': gamesInSession[sessionName].mapData['turnNumb'], 'nation':data['data']['nation']}
        rem = gamesInSession[sessionName].AddParticipant(data)
        if rem == 0:
            KickGameOff(sessionName)
        elif rem < 0:
            return '', 204
        return '', 201
    except:
        return '', 404


@app.route('/game/<gameName>/begin')
def KickGameOff(gameName):
    gamesInSession[gameName].BeginGame()
    del gamesForBrowsepage[gameName]
    return 'kicked off game ' + gameName