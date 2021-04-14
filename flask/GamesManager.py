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
        self.mapData['lockStep'] = False
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
        if self.mapData['lockStep'] == True:
            requiredMoves = [nation for nation in self.mapData['nationInfo'] if self.mapData['nationInfo'][nation]['score'] != len(self.mapData['nationInfo'][nation]['troopsDeployed']) or len(self.mapData['nationInfo'][nation]['defeats']) > 0 ]
            self.TurnManager = {"expectingFrom":requiredMoves, "QueuedMoves":{}}
            print('We locksteppin\'')
            print(requiredMoves)
        else:
            self.TurnManager = {"expectingFrom":list(self.participants.keys()), "QueuedMoves":{}}
            self.mapData['turnNumb'] += 1

    def QueueMove(self, uid, queuedMoves):
        nationTag = self.participants[uid]['nation']
        print('recieved moves for ' + nationTag)
        self.TurnManager['QueuedMoves'][nationTag] = queuedMoves
        if uid in self.TurnManager['expectingFrom']:
            self.TurnManager["expectingFrom"].remove(uid)
        print(self.TurnManager)
    
    def ExecuteQueuedMoves(self):
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
                        skirmishLedger[overpoweringProvince]['defence'] = True
                    except:
                        pass
                    bounceFlag = True
                    skirmishLedger[attack['fromProv']]['defence'] = True
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
        for moveChain in moveChains:
            try:
                destinationTuple = moveChain.pop() 
                while len(moveChain) > 0:
                    sourceTuple = moveChain.pop()
                    if sourceTuple[1] > skirmishLedger[destinationTuple[0]]['defence']:
                        self.MoveTroop(sourceTuple[0], destinationTuple[0])
                        destinationTuple = sourceTuple
                    else:
                        #The attack fails and it defends against those behind it on the chain
                        #Note that defence was 0 until now
                        skirmishLedger[sourceTuple[0]]['defence'] = 1
            except:
                continue
        self.BeginNewTurn()



    def MoveTroop(self, fromProv, toProv):
        source = self.mapData['provinceInfo'][fromProv]
        destination = self.mapData['provinceInfo'][toProv]
        movingNation = self.mapData['nationInfo'][source['owner']]
        movingNation['troopsDeployed'].remove(fromProv)
        movingNation['troopsDeployed'].append(toProv)
        if toProv in self.mapData['keyProvinces']:
                movingNation['score'] += 1
        if destination['owner'] in self.mapData['nationInfo']:
            overrunNation = self.mapData['nationInfo'][destination['owner']]
            overrunNation['provinces'].remove(toProv)
            if toProv in self.mapData['keyProvinces']:
                overrunNation['score'] -= 1
            if self.mapData['provinceInfo'][toProv]['troopPresence'] == True:
                self.mapData['nationInfo'][destination['owner']]['defeats'].append(toProv)
                self.mapData['lockStep'] = True
        
        destination['owner'] = source['owner']
        movingNation['provinces'].append(toProv)
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