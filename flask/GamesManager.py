from flask import request, jsonify
from flask_socketio import send, emit, join_room, leave_room
from webapp import app, socketApp
import FirebaseManger
from FirebaseManger import *
import webapp
import json
from os import path
from threading import Thread

print('Game manager is online')

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
        for i in range(len(gameData)):
            if not gameData[i]:
                continue
            for sourceProv in gameData[i]['standard']:
                print('servicing ' + sourceProv + ', ' + gameData[i]['standard'][sourceProv])
                gamesInSession[gameName].MoveTroop(sourceProv, gameData[i]['standard'][sourceProv])
            try:
                #TODO Resolve locksteps
                for sourceProv in gameData[i]['lockstep']:
                    lockMove = gameData[i]['lockstep'][sourceProv]['lockMove']
                    if lockMove == 'create':
                        gamesInSession[gameName].CreateTroop(sourceProv)
                gamesInSession[gameName].CullDefeats()
                pass
            except:
                pass
        gamesInSession[gameName].mapData['turnNumb'] = gameListing['turn']

        
def GetDataFromFile(fname):
    with open(path.join(path.dirname(__file__), 'backend_game_files/' + fname)) as f:
        return json.load(f)

metaMaps = GetDataFromFile('mapRosters.json')

@app.route('/gameconfigs')
def GetRosters():
    return metaMaps

def GetRoster(mapType):
    return metaMaps[mapType]["roster"].copy()



Thread(target=SetupExistingGames).start()

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
            self.ExecuteQueuedMoves()
    
    def ExecuteQueuedMoves(self):
        if self.mapData['lockStep'] == True:
            self.ResolveLockStep()
        else:
            self.ResolveSkirmshes()

    def CreateTroop(self, provID):
        nationID = self.mapData['provinceInfo'][provID]['owner']
        print(nationID + ' is deploying troop to ' + provID)
        self.mapData['nationInfo'][nationID]['troopsDeployed'].append(provID)
        self.mapData['provinceInfo'][provID]['troopPresence'] = True

    def TransferProvOwnership(self, newNationID, provID):
        previouseNationID = self.mapData['provinceInfo'][provID]['owner']
        try:
            self.mapData['nationInfo'][previouseNationID]['provinces'].remove(provID)
            self.UndeployFromProvince(previouseNationID, provID)
        except:
            pass
        self.mapData['provinceInfo'][provID]['owner'] = newNationID
        self.CreateTroop(provID)
        if len(provID.split('_')) == 1:
            self.mapData['nationInfo'][newNationID]['provinces'].append(provID)
    
    def RemoveTroopFromProv(self, provID):
        nationID = self.mapData['provinceInfo'][provID]['owner']
        self.mapData['provinceInfo'][provID]['troopPresence'] = False
        self.UndeployFromProvince(nationID, provID)

    def UndeployFromProvince(self, nationID, provID):
        self.mapData['nationInfo'][nationID]['troopsDeployed'].remove(provID)

    def CullDefeats(self):
        self.mapData['lockStep'] = False
        for nationID in self.mapData['nationInfo']:
            while len(self.mapData['nationInfo'][nationID]['defeats']) > 0:
                provID = self.mapData['nationInfo'][nationID]['defeats'].pop()
                self.UndeployFromProvince(nationID, provID)

    def ResolveLockStep(self):
        resolvedLockMoves = {}
        for nationID in self.TurnManager['QueuedMoves']:
            for provID in self.TurnManager['QueuedMoves'][nationID]:
                action = self.TurnManager['QueuedMoves'][nationID][provID]
                resolvedLockMoves[provID] = {'lockMove':action['lockMove']}
                if action['lockMove'] == 'retreat':
                    #self.UndeployFromProvince(nationID, provID)
                    #No need for the above, removal handled by culling 
                    self.CreateTroop(action['destProv'])
                    resolvedLockMoves[provID]['destProv'] = action['destProv'] 
                elif action['lockMove'] == 'create':
                    self.CreateTroop(provID)
                elif action['lockMove'] == 'destroy':
                    self.RemoveTroopFromProv(provID)
        UpdateResolvedMoves
        Thread(target=UpdateResolvedMoves, args=(self.gameName, self.mapData['turnNumb'], resolvedLockMoves, False,)).start()
        self.CullDefeats()
        self.BeginNewTurn()

    def ResolveSkirmshes(self):
        #before executing the moves, skirmishes must be constructed
        #skirmishes are objects which will track all moves done onto a province
        #A skirmish occurs if there is atleast one direct attacker  
        skirmishLedger = {}
        #support moves are buffered because they occur after attacks
        #supports on a province without a skirmish will do nothing
        supportAtkBuffer = []
        supportDefBuffer = []
        #this keeps track of what toops are actively attacking
        #any province not on this list automatically has a defence of 1
        activeTroops = []
        for nationTag in self.TurnManager["QueuedMoves"]:
            currentNationMoves = self.TurnManager["QueuedMoves"][nationTag]
            for fromProv in currentNationMoves:
                destProv = currentNationMoves[fromProv]['destProv']
                if currentNationMoves[fromProv]['moveType'] == 'Attack':
                    activeTroops.append(fromProv)
                    #all skirmishes start with an attack strength of 1 and a defence strength of zero
                    #defence is calculated later, it depends on the actions of the 'defender'
                    if destProv not in skirmishLedger:
                        skirmishLedger[destProv] = {'attacks':{}, 'defence':0}
                    skirmishLedger[destProv]['attacks'][nationTag] = {'fromProv': fromProv, "strength":1}
                elif currentNationMoves[fromProv]['moveType'] == 'Support Attack':
                    supportAtkBuffer.append({'nationTag': nationTag, 'fromProv': fromProv, 'destProv': destProv, 'supporting': currentNationMoves[fromProv]['supporting']})
                else:
                    supportDefBuffer.append({'nationTag': nationTag, 'fromProv': fromProv, 'destProv': destProv})
                    print('Adding the supporting move from ' + fromProv + ' to the support buffer')
        
        for provinceID in skirmishLedger:
            skirmishLedger[provinceID]['defence'] = 1 if provinceID not in activeTroops and self.mapData['provinceInfo'][provinceID]['troopPresence'] == True else 0

        print('COMBINING ALL QUEUED MOVES INTO BUFFERS YIELDED')
        print(supportAtkBuffer)
        print(supportDefBuffer)
        
        for support in supportAtkBuffer:
            destNation = self.mapData['provinceInfo'][support['destProv']]['owner']
            try:
                #this if statement handles support cutting
                if support['fromProv'] in skirmishLedger.keys() and len(skirmishLedger[support['fromProv']]['attacks'].keys()) > 0 and skirmishLedger[support['fromProv']]['attacks'][destNation]['fromProv'] != support['destProv']:
                    print(support['fromProv'] + '\'s support HAS BEEN CUT')
                    continue
                skirmishLedger[support['destProv']]['attacks'][support['supporting']]['strength'] += 1
            except:
                print('it just crashed')
                continue
        
        for support in supportDefBuffer:
            try:
                if support['fromProv'] in skirmishLedger.keys():
                    print(support['fromProv'] + '\'s support HAS BEEN CUT')
                    continue
                if skirmishLedger[support['destProv']]['defence'] > 0: 
                    skirmishLedger[support['destProv']]['defence'] += 1
            except:
                #if the supported province is not on the ledger, defence doesn't even matter
                print('unnecessary support for ' + support['destProv'])
                continue
        
        print('COMBINING ALL BUFFERS INTO SKIRMISHES YIELDED')
        print(skirmishLedger)

        moveChains = []
        chainStarts = {}
        chainEnds = {}
        
        for provinceID in skirmishLedger:
            localSkirmishLedger = skirmishLedger[provinceID]
            defencePower = localSkirmishLedger['defence']
            maxStrength = 0
            overpoweringProvince = ''
            bounceFlag = False
            attacks = localSkirmishLedger['attacks']
            for attackingNation in attacks:
                attack = attacks[attackingNation]
                if attack['strength'] > maxStrength:
                    maxStrength = attack['strength']
                    overpoweringProvince = attack['fromProv']
                    print(attackingNation + ' is the greatest threat to ' + provinceID)
                    bounceFlag = False
                elif attack['strength'] == maxStrength:
                    try:
                        skirmishLedger[overpoweringProvince]['defence'] = 1
                        skirmishLedger[attack['fromProv']]['defence'] = 1
                    except:
                        pass
                    bounceFlag = True
            if maxStrength > defencePower and bounceFlag == False:
                if provinceID in chainStarts:
                    print('adding ' + overpoweringProvince + 'to start of a list')
                    moveChains[chainStarts[provinceID]].insert(0, (overpoweringProvince, maxStrength))
                    chainStarts[overpoweringProvince] = chainStarts[provinceID]
                    del chainStarts[provinceID]

                    try:
                        moveChains[chainEnds[overpoweringProvince]].pop()
                        moveChains[chainEnds[overpoweringProvince]] += moveChains[chainStarts[overpoweringProvince]].copy()
                        moveChains[chainStarts[overpoweringProvince]].clear()
                        chainEnds[moveChains[chainEnds[overpoweringProvince][-1][0]]] = chainEnds[overpoweringProvince]
                        del chainEnds[overpoweringProvince]
                        del chainStarts[overpoweringProvince]
                    except:
                        pass
                elif overpoweringProvince in chainEnds:
                    print('adding ' + overpoweringProvince + 'to end of a list')
                    moveChains[chainEnds[overpoweringProvince]][-1] = (overpoweringProvince, maxStrength)
                    moveChains[chainEnds[overpoweringProvince]].append((provinceID, -1))
                    chainEnds[provinceID] = chainEnds[overpoweringProvince]
                    del chainEnds[overpoweringProvince]

                    if provinceID in chainStarts:
                        moveChains[chainEnds[overpoweringProvince]].pop()
                        moveChains[chainEnds[overpoweringProvince]] += moveChains[chainStarts[overpoweringProvince]].copy()
                        moveChains[chainStarts[overpoweringProvince]].clear()
                        chainEnds[moveChains[chainEnds[overpoweringProvince]]] = chainEnds[overpoweringProvince]
                        del chainEnds[overpoweringProvince]
                        del chainStarts[overpoweringProvince]
                        
                else:
                    moveChains.append([(overpoweringProvince, maxStrength),(provinceID, -1)])
                    idx = len(moveChains)-1
                    chainStarts[overpoweringProvince] = idx
                    chainEnds[provinceID] = idx
            else:
                print('bounce occured over ' + provinceID)
                try:
                    skirmishLedger[overpoweringProvince]['defence'] = 1
                except:
                    pass
        print(moveChains)
        actualMoves = {}
        for moveChain in moveChains:
            print(moveChain)
            try:
                destinationTuple = moveChain.pop() 
                while True:
                    sourceTuple = moveChain.pop()
                    print('popping chain', sourceTuple)

                    if sourceTuple[1] > skirmishLedger[destinationTuple[0]]['defence']:
                        print('moving')
                        self.MoveTroop(sourceTuple[0], destinationTuple[0])
                        actualMoves[sourceTuple[0]] = destinationTuple[0]
                    else:
                        #The attack fails and it defends against those behind it on the chain
                        #Note that defence was 0 until now
                        print(sourceTuple[0] + ' did not move because ' + destinationTuple[0] + ' has a defence rating of ' + destinationTuple[1])
                        skirmishLedger[sourceTuple[0]]['defence'] = 1
                    destinationTuple = sourceTuple
                    if len(moveChain) == 0:
                        break
            except Exception as ex:
                print(ex)
                print('eyyo wtf dog?')
                continue
        Thread(target=UpdateResolvedMoves, args=(self.gameName, self.mapData['turnNumb'], actualMoves,)).start()
        self.BeginNewTurn()



    def MoveTroop(self, fromProv, toProv):
        source = self.mapData['provinceInfo'][fromProv]
        movingNationID = source['owner']
        movingNation = self.mapData['nationInfo'][movingNationID]
        destination = self.mapData['provinceInfo'][toProv]
        destinationNationID = destination['owner']
        if destination['troopPresence'] == True:
            try:
                destinationNation = self.mapData['nationInfo'][movingNationID]
                self.mapData['nationInfo'][destinationNationID]['defeats'].append(toProv)
                self.mapData['lockStep'] = True
                if toProv in self.mapData['keyProvinces']:
                    destinationNation['score'] -= 1
            except:
                pass

        print(movingNationID + ' is moving ' + fromProv + ' to ' + toProv)
        self.RemoveTroopFromProv(fromProv)
        self.TransferProvOwnership(movingNationID, toProv)
        if toProv in self.mapData['keyProvinces']:
                movingNation['score'] += 1
                self.mapData['lockStep'] = True

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
            print(updateFirebase)
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