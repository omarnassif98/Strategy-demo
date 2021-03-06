console.log('Socket script is running');
var socket = io()

function ConnectSocket(gameName){
    socket = io.connect(location.origin, {transports: ['websocket']});
    socket.on('connect', () => {
        console.log(socket.id);
        SendToSocketServer('hook-game', {'room':gameName})
    });
    socket.on('message', (data) => {
        AppendToChat(data.sender, data.message, data.sender);
    })
    socket.on('bcastMessage', (data) => {
        AppendToChat('all', data.message, data.sender);
    })
    socket.on('game_progress', () => {
        console.log('refreshing');
        RefreshGame()
    })
}

function SendMessage(inputfield, target){
    let message = inputfield.value
    if (message.length == 0){
        return;
    }
    if(target == 'all'){
        SendToSocketServer('broadcastMessage', {'message':message})
    }else{
        SendToSocketServer('sendMessage', {'message':message, 'target':chatFocused})
    }
    AppendToChat(target, message, gameInfo.playingAs);
    inputfield.value = ''
}

function SendToSocketServer(HOOK, data){
    data.uid = firebase.auth().currentUser.uid;
    data.sid = socket.id;
    data.room = gameName;
    socket.emit(HOOK, data);
}