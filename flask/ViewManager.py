from flask import render_template, send_from_directory
from webapp import app
print('View manager online')

@app.route('/')
def Landing():
    return render_template('landing.html')

@app.route('/browse')
def Login():
    return render_template('browse games.html')

@app.route('/game/<gameName>')
def Game(gameName):
    return render_template('game.html')

@app.route('/game/<gameName>/debug')
def MapBuilder(gameName):
    return render_template('mapBuilder.html')

@app.route('/mapResources/<mapName>')
def SendEuropeSVG(mapName):
    try:
        return send_from_directory('static', mapName+'.svg')
    except:
        return '', 204

@app.route('/tank')
def SendTankGraphic():
    return send_from_directory('static', 'tank.svg')

@app.route('/star')
def SendStarGraphic():
    return send_from_directory('static', 'star.svg')
