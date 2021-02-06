from flask import Flask, url_for, render_template, redirect, request, send_from_directory
app = Flask(__name__)

@app.route('/')
def Landing():
    return render_template('game.html')

@app.route('/europe')
def SendEuropeSVG():
    print('SENDING THE SVG... HERE\'S HOPING!')
    return send_from_directory('static', 'europe stable.svg')

if __name__ == '__main__':  # pragma: no cover
    app.run(port=8080, debug=True)