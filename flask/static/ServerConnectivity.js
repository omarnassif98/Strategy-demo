async function SendCommandsToServer(){
    console.log('SENDING ORDERS');
    let res = await ResourceRequest(baseURL + '/clientDeliver', 'POST', {'uid': firebase.auth().currentUser.uid, 'session': gameName, 'moves':gameInfo.queuedMoves});
    console.log(res);
}