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
                        print('DING DING FUCKING DING')
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
