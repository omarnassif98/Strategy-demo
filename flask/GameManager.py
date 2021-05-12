from flask import request, jsonify
from os import path
import json
from webapp import app
from threading import Thread
from Game import GameSession
from FirebaseManger import *
gamesForBrowsepage = {}
gamesInSession = {}
playerSessions = {}


def GetDataFromFile(fname):
    with open(path.join(path.dirname(__file__), 'backend_game_files/' + fname)) as f:
        return json.load(f)

metaMaps = GetDataFromFile('mapRosters.json')

@app.route('/gameconfigs')
def GetRosters():
    return metaMaps

def GetRoster(mapType):
    return metaMaps[mapType]["roster"].copy()

def SetupExistingGames():
    print('Setting up existing active games')
    listings = GetActiveListings()
    print(listings)
    if not listings:
        return
    for gameName in listings:
        gameListing = listings[gameName]
        gameData = GetActiveGameData(gameName)
        print(gameListing)
        relevantGame = gamesInSession[gameName] = GameSession({'mapType':gameListing['mapType']}, gameName, GetRoster(gameListing['mapType']), GetDataFromFile(gameListing['mapType'] + '.json'))
        for uid in gameListing['participants']:
            #TODO still gotta register usernames
            AddPlayerToGame(gameName,{'uid':uid, 'data':{'nation':gameListing['participants'][uid]}}, False)
        relevantGame.BeginGame()
        if gameData:
            for i in range(1, len(gameData)):
                print('Now looking at turn ' + str(i))
                if not gameData[i]:
                    relevantGame.ExecuteQueuedMoves()
                    if relevantGame.mapData['lockStep']:
                        relevantGame.ExecuteQueuedMoves()
                    relevantGame.BeginNewTurn()
                    continue
                if 'standard' in gameData[i]:
                    for nationID in gameData[i]['standard']:
                        relevantGame.TurnManager['QueuedMoves'][nationID] = gameData[i]['standard'][nationID]
                        print('Queued ', gameData[i]['standard'][nationID], 'for', nationID)
                relevantGame.ExecuteQueuedMoves()   
                relevantGame.BeginNewTurn()
                
                if 'lockstep' in gameData[i] or relevantGame.mapData['lockStep']:
                    print('THIS IS BEING EXECUTED ON TURN', i)
                    try:
                        for nationID in gameData[i]['lockstep']:
                            relevantGame.TurnManager['QueuedMoves'][nationID] = gameData[i]['lockstep'][nationID]
                    finally:
                        relevantGame.ExecuteQueuedMoves()
                        relevantGame.BeginNewTurn()
                        continue

            if relevantGame.mapData['lockStep'] and relevantGame.mapData['turnNumb'] != gameListing['turn']:
                print('making up for lack of standard move')
                relevantGame.ExecuteQueuedMoves()
                relevantGame.BeginNewTurn()
            print('catching up to game listing')
            while relevantGame.mapData['turnNumb'] < gameListing['turn']:
                relevantGame.ExecuteQueuedMoves()
                relevantGame.BeginNewTurn()


Thread(target=SetupExistingGames, args=()).start()

@app.route('/gameList')
def ListGames():
    return json.dumps(gamesForBrowsepage)

@app.route('/game-check/<gameName>')
def CheckGameExistence(gameName):
    if(gameName in gamesInSession):
        return 'exists', 204
    else:
        return '', 201

@app.route('/game-create', methods=['POST'])
def CreateGame():
    body = request.get_json()
    print(body)
    if(body['gameName'] not in gamesInSession):
        gamesInSession[body["gameName"]] = GameSession(body["gameSettings"], body["gameName"], GetRoster(body['gameSettings']['mapType']), GetDataFromFile(body['gameSettings']['mapType'] + '.json'))
        gamesForBrowsepage[body["gameName"]] = {"host":body['participantData']['data']['username'], 'remaining':gamesInSession[body["gameName"]].gameSettings["remaining"]}
        AddPlayerToGame(body['gameName'], body['participantData'])        
        return '', 201
    else:
        return '', 204

@app.route('/game-join', methods=['POST'])
def JoinGame():
    from SocketManager import TriggerUpdate
    body = request.get_json()
    gameName = body['gameName']
    remainingSlots = AddPlayerToGame(gameName, body['participantData'])
    if remainingSlots == 0:
        TriggerUpdate('game_update', body['gameName'])
    elif remainingSlots < 0:
        return '', 204
    return '', 201

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
    from SocketManager import TriggerUpdate
    body = request.get_json()
    relevantGame = gamesInSession[body['session']]
    if body['turn'] == relevantGame.mapData['turnNumb']:
        previouslyLockStep = relevantGame.mapData['lockStep']
        resolution = relevantGame.QueueMove(body['uid'], body['moves'])
        if resolution == True:
            relevantGame.BeginNewTurn()
            TriggerUpdate('game_progress', relevantGame.gameName)
            Thread(target=UpdateActiveGame, args=(relevantGame.gameName, relevantGame.mapData['turnNumb'], previouslyLockStep, relevantGame.mapData['lockStep'])).start()
        elif resolution == False:
            TriggerUpdate('game_end', relevantGame.gameName)
            Thread(target=ArchiveGame, args=(relevantGame.gameName, relevantGame.moveHistory, relevantGame.mapData['winner'], relevantGame.participants)).start()

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
    #Remove hook upon release
    gamesInSession[gameName].BeginGame()
    del gamesForBrowsepage[gameName]
    Thread(target=ActivateGameListing, args=(gameName,)).start()
    return 'kicked off game ' + gameName

@app.route('/game/<gameName>/boost')
def boostFrance(gameName):
    gamesInSession[gameName].mapData['nationInfo']['FRA']['score'] = 17
    return 'france now has a score of 17'
