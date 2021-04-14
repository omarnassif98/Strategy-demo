async function SendCommandsToServer(buttonRef){
    console.log('SENDING ORDERS');
    let res = await ResourceRequest(baseURL + '/clientDeliver', 'POST', {'uid': firebase.auth().currentUser.uid, 'turn':gameInfo.turnNumb, 'session': gameName, 'moves':gameInfo.queuedMoves});
    if(res == 201){
        buttonRef.style.disabled = true;
    }
}

async function LoadGameConfiguration(auth){
    var resJSON = null;
    if(auth){
        resJSON = JSON.parse(await ResourceRequest(baseURL +  '/game/' + gameName + '/data', 'POST', {'uid':auth}));
    }else{
        resJSON = JSON.parse(await ResourceRequest(baseURL +  '/game/' + gameName + '/data'));
    }
    console.log(resJSON);
    if(gameInfo.turnNumb != resJSON.turnNumb){
        gameInfo = {...gameInfo, ...resJSON};
    }
    
}

async function LoadMap() {
    let req = await ResourceRequest(baseURL + '/mapResources/' + gameInfo.mapType);
    const resXML = new DOMParser().parseFromString(req, 'image/svg+xml');
    const wrapperGroup = document.createElementNS("http://www.w3.org/2000/svg","g");
    const svgObj = resXML.getElementById('gameMap');
    svgObj.querySelectorAll('#gameMap > path').forEach(element => {
        const provID = element.getAttribute('id');
        allProvIDs.push(provID)
        console.log(provID);
        console.log(element);
        element.removeAttribute('style');
        element.classList.add('province');
        if(element.getAttribute("id").split('_').length < 2){
            element.classList.add('land');
        }else{
            element.classList.add('ocean');
            gameInfo.provinceInfo[provID].owner = null;
        }
        element.addEventListener('click',function(){
            ProvinceSelect(provID, true);
        });
        
        element.addEventListener('contextmenu',function(event){
            ProvinceSelect(provID, false);
            event.preventDefault();
        });
    });
    svgObj.appendChild(wrapperGroup);
    const overlay = document.getElementById('gameArea').replaceChild(svgObj, document.getElementById('gameArea').firstChild);
    document.getElementById('gameArea').appendChild(overlay);

}
async function LoadTankGraphic(){
    const resXML = new DOMParser().parseFromString(await ResourceRequest(baseURL + '/tank'), 'image/svg+xml');
    const svgObj = resXML.getElementsByClassName('tank')[0];
    console.log(svgObj);
    tankGraphic = svgObj;
    tankGraphic.style.pointerEvents = 'none';
}
async function LoadStarGraphic(){
    const resXML = new DOMParser().parseFromString(await ResourceRequest(baseURL + '/star'), 'image/svg+xml');
    const svgObj = resXML.getElementById('star');
    console.log(svgObj);
    starGraphic = svgObj;
    starGraphic.style.pointerEvents = "none";
}
async function RefreshGame(){
    await LoadGameConfiguration();

}