async function SendCommandsToServer(){
    console.log('SENDING ORDERS');
    let res = await ResourceRequest(baseURL + '/clientDeliver', 'POST', gameInfo.queuedMoves);
    console.log(res);
}