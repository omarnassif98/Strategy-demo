async function SendCommandsToServer(){
    console.log('SENDING ORDERS');
    let turnNumb = gameInfo.turnNumb;
    let moveType = (gameInfo.lockStep)? 'lockstep':'standard';
    let queuedMoves = {...gameInfo.queuedMoves};
    let res = await ResourceRequest(baseURL + '/clientDeliver', 'POST', {'uid': firebase.auth().currentUser.uid, 'turn':gameInfo.turnNumb, 'session': gameName, 'moves':gameInfo.queuedMoves});
    if(res == 201){
        database.ref('active_game_data/' + gameName + "/orders/" + turnNumb + '/' + moveType + '/' + gameInfo.playingAs).set(queuedMoves);
    }
}

async function LoadGameConfiguration(auth, gameInfo){
    var resJSON = null;
    if(auth){
        resJSON = JSON.parse(await ResourceRequest(baseURL +  '/game/' + gameName + '/data', 'POST', {'uid':auth}));
    }else{
        resJSON = JSON.parse(await ResourceRequest(baseURL +  '/game/' + gameName + '/data'));
    }
    console.log(resJSON);
    return {...gameInfo, ...resJSON};    
}