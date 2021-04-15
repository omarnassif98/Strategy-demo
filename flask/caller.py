from webapp import socketApp, app

if __name__ == '__main__':  # pragma: no cover
    socketApp.run(app, port=8080, debug=True)