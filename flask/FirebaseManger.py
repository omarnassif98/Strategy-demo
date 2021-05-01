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
    return db.reference('active_game_data/' + gameName + '/resolved_moves').get()

def ActivateGameListing(gameTitle):
    ref = db.reference('pre_game_listings/' + gameTitle)
    data = ref.get()
    data['turn'] = 0
    ref.delete()
    print('SHOULD BE DELETED')
    db.reference('active_game_listings/' + gameTitle).set(data)

def UpdateResolvedMoves(gameTitle, turnNumb, resolvedMoves, standard = True):
    print('Attempting update on ' + gameTitle + ', turn')
    print(resolvedMoves)
    moveType = 'standard' if standard else 'lockstep'
    if standard:
        db.reference('active_game_listings/' + gameTitle + '/turn').set(turnNumb+1)
    if resolvedMoves:
        db.reference('active_game_data/' + gameTitle + '/resolved_moves/' + str(turnNumb) + '/' + moveType).set(resolvedMoves)