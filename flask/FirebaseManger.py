from firebase_admin import initialize_app as init_firebase, credentials, db
from os import path

firebase_cred = credentials.Certificate(path.join(path.dirname(__file__), 'firebase-admin-sdk.json'))
init_firebase(firebase_cred, {
    'databaseURL':'https://deception-616b8-default-rtdb.firebaseio.com/', 
    'databaseAuthVariableOverride': {'uid': 'flask-admin'}})
print('connection established with Firebase as admin')

def GetPreListings():
    return db.reference('pre_game_listings').get()

def GetActiveListings():
    return db.reference('active_game_listings').get()

def GetActiveGameData(gameName):
    return db.reference('active_game_data/' + gameName + '/orders').get()

def ActivateGameListing(gameTitle):
    ref = db.reference('pre_game_listings/' + gameTitle)
    data = ref.get()
    data['turn'] = 1
    ref.delete()
    db.reference('active_game_listings/' + gameTitle).set(data)

def UpdateActiveGame(gameTitle, turnNumb, currentlyLockstep, nextLockstep):
    print('Attempting update on ' + gameTitle + ', turn')
    moveType = 'lockstep' if currentlyLockstep else 'standard'
    db.reference('active_game_listings/' + gameTitle + '/lockstep').set(nextLockstep)
    if not nextLockstep:
        db.reference('active_game_listings/' + gameTitle + '/turn').set(turnNumb+1)

def ArchiveGame(gameTitle, resolvedMoves, winner, participants):
    data = db.reference('active_game_data/' + gameTitle).get()
    data['participants'] = {uid:participants[uid]['nation'] for uid in participants}
    data['resolved_moves'] = resolvedMoves
    archiveID = db.reference('archived_game_data').push(data)
    for participantUID in participants:
        db.reference('user_data/' + participantUID + '/archive_game_history').push({'gameName': gameTitle, 'playedAs':participants[participantUID], 'winner':winner})
    db.reference('active_game_data/' + gameTitle).delete()
