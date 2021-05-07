from flask import request, jsonify
from flask_socketio import send, emit, join_room, leave_room
from webapp import app, socketApp
import FirebaseManger
from FirebaseManger import *
import webapp
import json
from os import path
from threading import Thread
import traceback
from GameResolver import BuildSkirmishLedger, SimplifySkirmishes, ConstructMoveChains
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
    def __init__(self, gameSettings, gameName):
        self.gameName = gameName
        self.gameSettings = gameSettings
        print(gameSettings)
        self.gameSettings["remaining"] = GetRoster(self.gameSettings["mapType"])
        self.mapData = GetDataFromFile(gameSettings['mapType'] + '.json')
        self.mapData['turnNumb'] = 0
        self.mapData['lockStep'] = False
        self.participants = {}
        self.TurnManager = {}
        self.occupiedKeys = {}
    
    def BeginGame(self):
        self.BeginNewTurn()

    def GetAvailableNations(self):
        return self.gameSettings["remaining"]
    
    def AddParticipant(self, participantData):
        print('ADDING ' + str(participantData))
        print(self.gameSettings["remaining"])
        if participantData["data"]['nation'] in self.gameSettings["remaining"]:
            self.participants[participantData["uid"]] = participantData["data"]
            self.gameSettings["remaining"].remove(participantData['data']["nation"])
            print(self.gameSettings["remaining"])
            if(len(self.gameSettings["remaining"]) == 0):
                self.BeginGame()
                AlertOfNewRound(self.gameName)
            return len(self.gameSettings["remaining"])
        else:
            print('Remaining:')
            print(self.gameSettings['remaining'])
            return -2

    def AttachSocketToUser(self, uid, socket):
        self.participants[uid]['socket'] = socket

    def GetNationSocket(self, nationID):
        for uid in self.participants:
            if self.participants[uid]['nation'] == nationID:
                return self.participants[uid]['socket']

    
    def GetPlayerNation(self, uid):
        return self.participants[uid]['nation']
    
    def GetMapData(self):
        return self.mapData.copy()
    
    def BeginNewTurn(self):
        if self.mapData['lockStep'] == True:
            requiredMoves = [self.GetPlayerNation(uid) for uid in self.participants.keys() if self.mapData['nationInfo'][self.GetPlayerNation(uid)]['score'] != len(self.mapData['nationInfo'][self.GetPlayerNation(uid)]['troopsDeployed']) or len(self.mapData['nationInfo'][self.GetPlayerNation(uid)]['defeats']) > 0 ]
            self.TurnManager = {"expectingFrom":requiredMoves, "QueuedMoves":{}}
            print('We locksteppin\'')
            print('Waiting for ' + str(requiredMoves))
            print(requiredMoves)
            AlertOfNewRound(self.gameName)
        else:
            self.TurnManager = {"expectingFrom":list([self.GetPlayerNation(uid) for uid in self.participants.keys()]), "QueuedMoves":{}}
            self.mapData['turnNumb'] += 1
            print('Advancing turn')
            AlertOfNewRound(self.gameName)

    def QueueMove(self, uid, queuedMoves):
        nationTag = self.participants[uid]['nation']
        print('recieved moves for ' + nationTag)
        self.TurnManager['QueuedMoves'][nationTag] = queuedMoves
        if nationTag in self.TurnManager['expectingFrom']:
            self.TurnManager["expectingFrom"].remove(nationTag)
        print('still expecting', len(self.TurnManager["expectingFrom"]), 'moves')
        if len(self.TurnManager["expectingFrom"]) == 0:
            print('ALL MOVES QUEUED')
            self.ExecuteQueuedMoves(True)
    def ExecuteQueuedMoves(self, writeToFirebase = False):
        if self.mapData['lockStep'] == True:
            self.ResolveLockStep(writeToFirebase)
        else:
            self.ResolveSkirmshes(writeToFirebase)

    def CreateTroop(self, nationID, provID):
        self.mapData['nationInfo'][nationID]['troopsDeployed'].append(provID)
        self.mapData['provinceInfo'][provID]['troopPresence'] = nationID

    def TransferProvOwnership(self, newNationID, provID):
        print(provID + ' NOW BELONGS TO ' + newNationID)
        previousNationID = self.mapData['provinceInfo'][provID]['owner']
        try:
            self.mapData['nationInfo'][previousNationID]['provinces'].remove(provID)
            self.UndeployFromProvince(previousNationID, provID)
        except:
            pass
        self.mapData['provinceInfo'][provID]['owner'] = newNationID
        if len(provID.split('_')) == 1:
            self.mapData['nationInfo'][newNationID]['provinces'].append(provID)

    def OccupyKeyProv(self, nationID, provID):
        self.occupiedKeys[provID] = {'nationID':nationID, 'turnOccupied':self.mapData['turnNumb']}
        self.CreateTroop(nationID, provID)
    
    def ResolveOccupiedKeyProvs(self):
        print('NOW RESOLVING FOR TURN ' + str(self.mapData['turnNumb']))
        for provID in self.occupiedKeys.copy():
            occupyingNationID = self.mapData['provinceInfo'][provID]['troopPresence']
            ownerNationID = self.mapData['provinceInfo'][provID]['owner']
            if self.occupiedKeys[provID]['turnOccupied'] < self.mapData['turnNumb']:
                if self.occupiedKeys[provID]['nationID'] == occupyingNationID:
                    self.TransferProvOwnership(occupyingNationID, provID)
                    try:
                        self.mapData['nationInfo'][occupyingNationID]['score'] += 1
                        self.mapData['lockStep'] = True
                        self.mapData['nationInfo'][ownerNationID]['score'] -= 1
                    except:
                        pass
                print('deleting occupation of ' + provID)
                del self.occupiedKeys[provID]
    
    def RemoveTroopFromProv(self, provID):
        nationID = self.mapData['provinceInfo'][provID]['troopPresence']
        self.mapData['provinceInfo'][provID]['troopPresence'] = None
        self.UndeployFromProvince(nationID, provID)

    def UndeployFromProvince(self, nationID, provID):
        self.mapData['nationInfo'][nationID]['troopsDeployed'].remove(provID)

    def CullDefeats(self):
        self.mapData['lockStep'] = False
        for nationID in self.mapData['nationInfo']:
            self.mapData['nationInfo'][nationID]['defeats'].clear()

    def ResolveLockStep(self, writeToFirebase = False):
        resolvedLockMoves = {}
        for nationID in self.TurnManager['QueuedMoves']:
            print('LOCK MOVES FOR ' + nationID)
            print(str(self.TurnManager['QueuedMoves'][nationID]))
            for provID in self.TurnManager['QueuedMoves'][nationID]:
                action = self.TurnManager['QueuedMoves'][nationID][provID]
                resolvedLockMoves[provID] = {'lockMove':action['lockMove']}
                if action['lockMove'] == 'retreat':
                    #self.UndeployFromProvince(nationID, provID)
                    #No need for the above, removal handled by culling 
                    self.CreateTroop(nationID, action['destProv'])
                    resolvedLockMoves[provID]['destProv'] = action['destProv'] 
                elif action['lockMove'] == 'create':
                    self.CreateTroop(nationID, provID)
                elif action['lockMove'] == 'destroy':
                    self.RemoveTroopFromProv(provID)
                    #Troop already undeployed
                    print(provID + ' overrun, all presence of ' + nationID + ' destroyed')
        if writeToFirebase:
            Thread(target=UpdateResolvedMoves, args=(self.gameName, self.mapData['turnNumb'], resolvedLockMoves, True, False)).start()
        self.CullDefeats()
        self.BeginNewTurn()

    def ResolveSkirmshes(self, writeToFirebase = False):
        skirmishLedger = BuildSkirmishLedger(self.TurnManager['QueuedMoves'], self.mapData['provinceInfo'])
        skirmishes = SimplifySkirmishes(skirmishLedger)
        moveChains = ConstructMoveChains(skirmishes)
        print(skirmishLedger)
        print('RESULT', moveChains)
        for moveChain in moveChains:
            try:
                chain = moveChain['chain']
                if moveChain['loop']:
                    bufferDest = chain.pop()
                    destinationTuple = chain.pop()
                    bufferMove = (self.mapData['provinceInfo'][destinationTuple[0]]['troopPresence'], bufferDest[0])
                    print('BUFFER:', bufferMove)
                    while len(chain) > 0:
                        sourceTuple = chain.pop()
                        self.MoveTroop(sourceTuple[0], destinationTuple[0], False)
                        destinationTuple = sourceTuple
                    self.CreateTroop(bufferMove[0], bufferMove[1])
                    if bufferMove[1] in self.mapData['keyProvinces']:
                        self.OccupyKeyProv(bufferMove[0], bufferMove[1])
                    else:
                        self.TransferProvOwnership(bufferMove[0], bufferMove[1])
                else:
                    destinationTuple = chain.pop()
                    while len(chain) > 0:
                        sourceTuple = chain.pop()
                        if sourceTuple[1] > skirmishLedger[destinationTuple[0]]['defence']:
                            print('\nmoving')
                            self.MoveTroop(sourceTuple[0], destinationTuple[0])
                        else:
                            #The attack fails and it defends against those behind it on the chain
                            #Note that defence was 0 until now
                            print(sourceTuple[0] + ' did not move because ' + destinationTuple[0] + ' has a defence rating of ' + destinationTuple[1])
                            skirmishLedger[sourceTuple[0]]['defence'] = 1
                        destinationTuple = sourceTuple
            except Exception as ex:
                traceback.print_exc()
                print(ex)
                print('eyyo wtf dog?')
                continue
        self.ResolveOccupiedKeyProvs()
        if writeToFirebase:
            Thread(target=UpdateResolvedMoves, args=(self.gameName, self.mapData['turnNumb'], False, self.mapData['lockStep'])).start()
        self.BeginNewTurn()


    def MoveTroop(self, fromProv, toProv, needsToOverpower = True):
        source = self.mapData['provinceInfo'][fromProv]
        movingNationID = source['troopPresence']
        destination = self.mapData['provinceInfo'][toProv]
        destinationNationID = destination['owner']    
        print('Dest: ', destinationNationID, '\'s ', toProv)
        print('Mover:',  movingNationID, 'from', fromProv)
        print(source)
        self.RemoveTroopFromProv(fromProv)
        if destination['troopPresence']:
            if needsToOverpower:
                self.mapData['nationInfo'][destinationNationID]['defeats'].append(toProv)
                self.mapData['lockStep'] = True
            self.UndeployFromProvince(destinationNationID, toProv)
            
    
        if toProv in self.mapData['nationInfo'][movingNationID]['provinces']:
            self.CreateTroop(movingNationID, toProv)
        else:
            print(toProv + 'is not within the borders of ' + movingNationID)
            if toProv in self.mapData['keyProvinces']:
                self.OccupyKeyProv(movingNationID, toProv)
            else:
                print(toProv + 'is not special')
                self.TransferProvOwnership(movingNationID, toProv)
                self.CreateTroop(movingNationID, toProv)
        print(movingNationID + ' is moving ' + fromProv + ' to ' + toProv)

def SetupExistingGames():
    print('Setting up existing active games')
    listings = GetActiveListings()
    print(listings)
    if not listings:
        return
    for gameName in listings:
        gameListing = listings[gameName]
        gameData = GetActiveGameData(gameName)
        print(gameData)
        gamesInSession[gameName] = GameSession({'mapType':gameListing['mapType']}, gameName)
        
        for uid in gameListing['participants']:
            #TODO still gotta register usernames
            AddPlayerToGame(gameName,{'uid':uid, 'data':{'nation':gameListing['participants'][uid]}}, False)
        if len(gameListing['participants']) < len(GetRoster(gameListing['mapType'])):
            print('Starting game prematurely')
            gamesInSession[gameName].BeginGame()
        if gameData:
            
            for i in range(1, len(gameData)):
                print('Now looking at turn ' + str(i))
                if not gameData[i]:
                    gamesInSession[gameName].ExecuteQueuedMoves()
                    if gamesInSession[gameName].mapData['lockStep']:
                        gamesInSession[gameName].ExecuteQueuedMoves()
                    continue
                if 'standard' in gameData[i]:
                    for nationID in gameData[i]['standard']:
                        gamesInSession[gameName].TurnManager['QueuedMoves'][nationID] = gameData[i]['standard'][nationID]
                        print('Queued ', gameData[i]['standard'][nationID], 'for', nationID)
                    gamesInSession[gameName].ExecuteQueuedMoves()   
                if 'lockstep' in gameData[i]:
                    for nationID in gameData[i]['lockstep']:
                        gamesInSession[gameName].TurnManager['QueuedMoves'][nationID] = gameData[i]['lockstep'][nationID]
                if gamesInSession[gameName].mapData['lockStep'] and gamesInSession[gameName].mapData['turnNumb'] != gameListing['turn']:
                    gamesInSession[gameName].ExecuteQueuedMoves()
            while gamesInSession[gameName].mapData['turnNumb'] < gameListing['turn']:
                gamesInSession[gameName].ExecuteQueuedMoves()

            if gamesInSession[gameName].mapData['lockStep']:
                gamesInSession[gameName].ExecuteQueuedMoves()

gamesForBrowsepage = {}
gamesInSession = {}
playerSessions = {}

Thread(target=SetupExistingGames, args=()).start()
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
        gamesInSession[body["gameName"]] = GameSession(body["gameSettings"], body["gameName"])
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


def AddPlayerToGame(sessionName, data, updateFirebase = True):
    uid = data['uid']
    if(uid not in playerSessions):
        playerSessions[uid] = {}
    try:
        playerSessions[uid][sessionName] = {'turnNumb': gamesInSession[sessionName].mapData['turnNumb'], 'nation':data['data']['nation']}
        rem = gamesInSession[sessionName].AddParticipant(data)
        if rem == 0:
            KickGameOff(sessionName)
            if updateFirebase:
                Thread(target=ActivateGameListing, args=(sessionName,)).start()
        elif rem < 0:
            return '', 204
        return '', 201
    except:
        return '', 404


@app.route('/game/<gameName>/begin')
def KickGameOff(gameName):
    #STRICTLY FOR TESTING
    #Remove upon release
    gamesInSession[gameName].BeginGame()
    del gamesForBrowsepage[gameName]
    Thread(target=ActivateGameListing, args=(gameName,)).start()
    return 'kicked off game ' + gameName

##############################################################

@socketApp.on('hook-game')
def roomJoin(data):
    join_room(data['room'])
    gamesInSession[data['room']].AttachSocketToUser(data['uid'], request.sid)
    print('welcome to ' + data['room'] + ', ' + request.sid)

@socketApp.on('sendMessage')
def sendMessage(data):
    print('client ' + request.sid + ' is messaging player ' + data['target'] + ' in room ' + data['room'])
    SendMessageToClient(data['message'], gamesInSession[data['room']].GetPlayerNation(data['uid']), gamesInSession[data['room']].GetNationSocket(data['target']))
@socketApp.on('broadcastMessage')
def broadcastToRoom(data):
    print('client ' + request.sid + ' has a message for room ' + data['room'])
    socketApp.emit('bcastMessage', {'message':data['message'], 'sender':gamesInSession[data['room']].GetPlayerNation(data['uid'])}, room=data['room'], include_self=False)


def SendMessageToClient(message, sender, sid):
    print(sender + ' says ' + message + ' to ' + sid)
    socketApp.emit('message', {'message':message, 'sender':sender}, to=sid)

def AlertOfNewRound(room):
    socketApp.emit('newRound', room=room)