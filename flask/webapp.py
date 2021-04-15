from flask import Flask
from flask_socketio import SocketIO
from werkzeug.middleware.proxy_fix import ProxyFix
print('Webapp is online')
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketApp = SocketIO(app)
print('Webapp up')
import GamesManager
import ViewManager