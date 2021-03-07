from flask import Flask, url_for, render_template, redirect, request, send_from_directory
app = Flask(__name__)

@app.route('/')
def Landing():
    return render_template('Landing.html')

@app.route('/browse')
def Login():
    return render_template('browse games.html')

@app.route('/game')
def Game():
    return render_template('game.html')

@app.route('/europe')
def SendEuropeSVG():
    return send_from_directory('static', 'europe.svg')

@app.route('/tank')
def SendTankGraphic():
    return send_from_directory('static', 'tank.svg')

@app.route('/gameState')
def SendProvinceData():
    print('SENDING JSON... HERE GOES')
    return send_from_directory('static', 'GameInfo.json')
#Each item above is a static resource, it will be taken out when nginx is introduced
###############################################################
gamesInSession = {}

@app.route('/game-create', methods=['POST'])
def CreateGame():
    print(request.get_json())
    return 'hi'

@app.route('/clientDeliver', methods=['POST'])
def RecieveCommand():
    print(request.get_json())
    return 'hi'
