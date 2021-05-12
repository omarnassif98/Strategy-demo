import traceback

def BuildSkirmishLedger(queuedMoves, mapData):
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
        for nationTag in queuedMoves:
            currentNationMoves = queuedMoves[nationTag]
            for fromProv in currentNationMoves:
                destProv = currentNationMoves[fromProv]['destProv']
                if currentNationMoves[fromProv]['moveType'] == 'Attack':
                    activeTroops.append(fromProv)
                    #all skirmishes start with an attack strength of 1 and a defence strength of zero
                    #defence is calculated later, it depends on the actions of the 'defender'
                    if destProv not in skirmishLedger:
                        skirmishLedger[destProv] = {'attacks':{}, 'defence':0}
                        print('Added ' + destProv + ' to skirmish ledger')
                    skirmishLedger[destProv]['attacks'][nationTag] = {'fromProv': fromProv, "strength":1}
                elif currentNationMoves[fromProv]['moveType'] == 'Support Attack':
                    supportAtkBuffer.append({'nationTag': nationTag, 'fromProv': fromProv, 'destProv': destProv, 'supporting': currentNationMoves[fromProv]['supporting']})
                else:
                    supportDefBuffer.append({'nationTag': nationTag, 'fromProv': fromProv, 'destProv': destProv})
        
        for provinceID in skirmishLedger:
            skirmishLedger[provinceID]['defence'] = 1 if provinceID not in activeTroops and mapData[provinceID]['troopPresence'] == True else 0
        
        for support in supportAtkBuffer:
            destNation = mapData[support['destProv']]['owner']
            try:
                #this if statement handles support cutting
                if support['fromProv'] in skirmishLedger.keys() and len(skirmishLedger[support['fromProv']]['attacks'].keys()) > 0 and skirmishLedger[support['fromProv']]['attacks'][destNation]['fromProv'] != support['destProv']:
                    continue
                skirmishLedger[support['destProv']]['attacks'][support['supporting']]['strength'] += 1
            except:
                continue
        
        for support in supportDefBuffer:
            try:
                if support['fromProv'] in skirmishLedger.keys():
                    continue
                if skirmishLedger[support['destProv']]['defence'] > 0: 
                    skirmishLedger[support['destProv']]['defence'] += 1
            except:
                #if the supported province is not the site of a skirmish, defence doesn't even matter
                continue
        return skirmishLedger


#OUTPUT = (FROM, TO, STRENGTH)
def SimplifySkirmishes(skirmishLedger):
    
    simplifiedLedger = []
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
                try:
                    skirmishLedger[overpoweringProvince]['defence'] = 1
                except:
                    pass
                overpoweringProvince = attack['fromProv']
                bounceFlag = False
            elif attack['strength'] == maxStrength:
                try:
                    skirmishLedger[overpoweringProvince]['defence'] = 1
                except:
                    pass
                try:
                    skirmishLedger[attack['fromProv']]['defence'] = 1
                except:
                    pass
                bounceFlag = True
            else:
                try:
                    print('Attack failed... Attempting to add defence to ' + attack['fromProv'])
                    skirmishLedger[attack['fromProv']]['defence'] = 1
                except:
                    pass
        if not bounceFlag and maxStrength > 0:
            simplifiedLedger.append((overpoweringProvince, provinceID, maxStrength))
    return(simplifiedLedger)


def ConstructMoveChains(simplifiedLedger):
    moveChains = []
    chainStarts = {}
    chainEnds = {}
    #GUARANTEES
    #ONLY ONE SOURCE PER DESTINATION
    #MOVECHAINS CAN LOOP, BUT LOOPS ARE ISOLATED
    #TODO Null concatinated chains instead of deleting them
    #TODO actually assign the idx's to chain start and end
    print('Simplified: ', simplifiedLedger)
    for simplifiedMove in simplifiedLedger:
        fromProv = simplifiedMove[0]
        toProv = simplifiedMove[1]
        strength = simplifiedMove[2]
        print(fromProv, toProv, strength)
        if toProv in chainStarts:
            moveChains[chainStarts[toProv]]['chain'].insert(0, [fromProv, strength])
            chainStarts[fromProv] = chainStarts[toProv]
            del chainStarts[toProv]
        elif fromProv in chainEnds:
            moveChains[chainEnds[fromProv]]['chain'][-1][1] = strength
            moveChains[chainEnds[fromProv]]['chain'].append([toProv, -1])
            chainEnds[toProv] = chainEnds[fromProv]
            del chainEnds[fromProv]
        else:
            newChain = moveChains.append({'chain':[[fromProv, strength], [toProv, -1]], 'loop':False})
            chainStarts[fromProv] = len(moveChains) - 1
            chainEnds[toProv] = len(moveChains) - 1
    
        for provID in [fromProv, toProv]:
            try:
                if provID in chainStarts and provID in chainEnds:
                    if chainStarts[provID] == chainEnds[provID]:
                        moveChains[chainStarts[provID]]['loop'] = True
                    else:
                        moveChains[chainEnds[provID]]['chain'].pop()
                        moveChains[chainEnds[provID]]['chain'] += moveChains[chainStarts[provID]]['chain']
                        moveChains[chainStarts[provID]] = None
                        newStart = moveChains[chainEnds[provID]]['chain'][0][0]
                        newEnd = moveChains[chainEnds[provID]]['chain'][-1][0]
                        chainEnds[newEnd] = chainEnds[provID]
                        chainStarts[newStart] = chainEnds[provID]
                        del chainStarts[provID]
                        chainStarts[newEnd]['loop'] = (newEnd == newStart)
            except Exception as ex:
                print(ex)
        
    return moveChains


class GameSession:
    def __init__(self, gameSettings, gameName, roster, mapData):
        self.gameName = gameName
        self.gameSettings = gameSettings
        print(gameSettings)
        self.gameSettings["remaining"] = roster
        self.mapData = mapData
        self.mapData['turnNumb'] = 0
        self.mapData['lockStep'] = False
        self.inPlay = False
        self.participants = {}
        self.TurnManager = {}
        self.occupiedKeys = {}
        self.moveHistory = {}
    def BeginGame(self):
        self.inPlay = True
        self.BeginNewTurn()

    def GetAvailableNations(self):
        return self.gameSettings["remaining"]
    
    def AddParticipant(self, participantData):
        print('ADDING ' + str(participantData))
        if participantData["data"]['nation'] in self.gameSettings["remaining"]:
            
            self.participants[participantData["uid"]] = participantData["data"]
            self.gameSettings["remaining"].remove(participantData['data']["nation"])
            print(self.gameSettings["remaining"])
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
        if self.inPlay:
            if self.mapData['lockStep'] == True:
                requiredMoves = [self.GetPlayerNation(uid) for uid in self.participants.keys() if len(self.mapData['nationInfo'][self.GetPlayerNation(uid)]['defeats']) > 0 ]
                if self.mapData['turnNumb'] % 2 == 0:
                    #This covers both those who have too little and those who have too much
                    requiredMoves += [self.GetPlayerNation(uid) for uid in self.participants.keys() if self.mapData['nationInfo'][self.GetPlayerNation(uid)]['score'] != len(self.mapData['nationInfo'][self.GetPlayerNation(uid)]['troopsDeployed'])]
                self.TurnManager = {"expectingFrom":requiredMoves, "QueuedMoves":{}}
                print('We locksteppin\'')
                print('Waiting for ' + str(requiredMoves))
                print(requiredMoves)
            else:
                self.TurnManager = {"expectingFrom":list([self.GetPlayerNation(uid) for uid in self.participants.keys()]), "QueuedMoves":{}}
                self.mapData['turnNumb'] += 1
                self.moveHistory[self.mapData['turnNumb']] = {'standard':{}, 'lockstep':{}}
                print('Advancing turn')
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
            return self.inPlay
    def ExecuteQueuedMoves(self):
        if self.mapData['lockStep'] == True:
            self.ResolveLockStep()
        else:
            self.ResolveSkirmshes()

    def CreateTroop(self, nationID, provID):
        self.mapData['nationInfo'][nationID]['troopsDeployed'].append(provID)
        self.mapData['provinceInfo'][provID]['troopPresence'] = nationID

    def TransferProvOwnership(self, newNationID, provID):
        previousNationID = self.mapData['provinceInfo'][provID]['owner']
        if provID in self.mapData['keyProvinces']:
            self.UpdateScores(newNationID, previousNationID, provID)
        try:
            self.mapData['nationInfo'][previousNationID]['provinces'].remove(provID)
        finally:
            if len(provID.split(('_'))) == 1:
                print(provID + ' NOW BELONGS TO ' + newNationID)
                self.mapData['provinceInfo'][provID]['owner'] = newNationID
                self.mapData['nationInfo'][newNationID]['provinces'].append(provID)
            return
    def ResolveOccupiedKeyProvs(self):
        print('NOW RESOLVING FOR TURN ' + str(self.mapData['turnNumb']))
        for provID in self.occupiedKeys.copy():
            occupyingNationID = self.mapData['provinceInfo'][provID]['troopPresence']
            ownerNationID = self.mapData['provinceInfo'][provID]['owner']
            if self.occupiedKeys[provID]['turnOccupied'] < self.mapData['turnNumb']:
                if self.occupiedKeys[provID]['nationID'] == occupyingNationID:
                    self.TransferProvOwnership(occupyingNationID, provID)
                    self.UpdateScores(occupyingNationID, ownerNationID, provID)
                print('deleting occupation of ' + provID)
                del self.occupiedKeys[provID]
    
    def UpdateScores(self, newNationID, previousNationID, provID):
            self.mapData['lockStep'] = True
            self.mapData['nationInfo'][newNationID]['score'] += 1
            try:
                self.mapData['nationInfo'][previousNationID]['score'] -= 1
            finally:
                if self.mapData['nationInfo'][newNationID]['score'] > len(self.mapData['keyProvinces'])/2:
                    self.inPlay = False
                    self.mapData['winner'] = newNationID
                return

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

    def ResolveLockStep(self):
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
        self.moveHistory[self.mapData['turnNumb']]['lockstep'] = resolvedLockMoves 
        self.CullDefeats()

    def ResolveSkirmshes(self):
        skirmishLedger = BuildSkirmishLedger(self.TurnManager['QueuedMoves'], self.mapData['provinceInfo'])
        skirmishes = SimplifySkirmishes(skirmishLedger)
        moveChains = ConstructMoveChains(skirmishes)
        resolvedStandardMoves = {}
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
                        resolvedStandardMoves[sourceTuple[0]] = destinationTuple[0]
                        destinationTuple = sourceTuple
                    self.CreateTroop(bufferMove[0], bufferMove[1])
                    resolvedStandardMoves[bufferMove[0]] = bufferMove[1]
                    if (bufferMove[1] not in self.mapData['keyProvinces']) or (bufferMove[1] in self.mapData['keyProvinces'] and self.mapData['turnNumb'] % 2 == 0):
                        self.TransferProvOwnership(bufferMove[0], bufferMove[1])
                else:
                    destinationTuple = chain.pop()
                    while len(chain) > 0:
                        sourceTuple = chain.pop()
                        if sourceTuple[1] > skirmishLedger[destinationTuple[0]]['defence']:
                            print('\nmoving')
                            self.MoveTroop(sourceTuple[0], destinationTuple[0])
                            resolvedStandardMoves[sourceTuple[0]] = destinationTuple[0]
                        else:
                            #The attack fails and it defends against those behind it on the chain
                            #Note that defence was 0 until now
                            skirmishLedger[sourceTuple[0]]['defence'] = 1
                        destinationTuple = sourceTuple
            except Exception as ex:
                traceback.print_exc()
                print(ex)
                continue
        self.moveHistory[self.mapData['turnNumb']]['standard'] = resolvedStandardMoves
        if self.mapData['turnNumb'] % 2 == 0:
            self.ResolveOccupiedKeyProvs()


    def MoveTroop(self, fromProv, toProv, needsToOverpower = True):
        source = self.mapData['provinceInfo'][fromProv]
        movingNationID = source['troopPresence']
        destination = self.mapData['provinceInfo'][toProv]
        destinationNationID = destination['owner']
        print(source)  
        print(destination)
        print('Dest: ', destinationNationID, '\'s ', toProv)
        print('Mover:',  movingNationID, 'from', fromProv)
        self.RemoveTroopFromProv(fromProv)
        if destination['troopPresence']:
            if needsToOverpower:
                self.mapData['nationInfo'][destinationNationID]['defeats'].append(toProv)
                self.mapData['lockStep'] = True
            self.UndeployFromProvince(destinationNationID, toProv)
        self.CreateTroop(movingNationID, toProv)        
        if (toProv not in self.mapData['nationInfo'][movingNationID]['provinces']) and ((toProv not in self.mapData['keyProvinces']) or (toProv in self.mapData['keyProvinces'] and self.mapData['turnNumb'] % 2 == 0)):
            self.TransferProvOwnership(movingNationID, toProv)
        elif toProv in self.mapData['keyProvinces'] and self.mapData['turnNumb'] % 2 != 0:
            self.occupiedKeys[toProv] = {'turnOccupied': self.mapData['turnNumb'], 'nationID': movingNationID}
        print(movingNationID + ' is moving ' + fromProv + ' to ' + toProv)
