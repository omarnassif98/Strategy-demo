async function SendCommandsToServer(buttonRef){
    console.log('SENDING ORDERS');
    let res = await ResourceRequest(baseURL + '/clientDeliver', 'POST', {'uid': firebase.auth().currentUser.uid, 'turn':gameInfo.turnNumb, 'session': gameName, 'moves':gameInfo.queuedMoves});
    if(res == 201){
        buttonRef.style.disabled = true;
    }
}

async function LoadGameConfiguration(){
    let resJSON = JSON.parse(await ResourceRequest(baseURL +  '/game/' + gameName + '/data'));
    console.log(resJSON);
    if(gameInfo.turnNumb != resJSON.turnNumb){
        gameInfo = {...gameInfo, ...resJSON};
    }
    
}

async function LoadMap() {
        const resXML = new DOMParser().parseFromString(await ResourceRequest(baseURL + '/europe'), 'image/svg+xml');
        console.log(resXML);
        const svgObj = resXML.getElementById('gameMap');
        svgObj.querySelectorAll('path').forEach(element => {
            const provID = element.getAttribute('id');
            element.removeAttribute('style');
            element.classList.add('province');
            element.addEventListener('click',function(){
                ProvinceSelect(provID);
            });
            const wrapperGroup = document.createElementNS("http://www.w3.org/2000/svg","g");
            element.parentElement.replaceChild(wrapperGroup, element);
            wrapperGroup.appendChild(element);
        });
        const overlay = document.getElementById('gameArea').replaceChild(svgObj, document.getElementById('gameArea').firstChild);
        document.getElementById('gameArea').appendChild(overlay);
        
    }
async function LoadTankGraphic(){
    const resXML = new DOMParser().parseFromString(await ResourceRequest(baseURL + '/tank'), 'image/svg+xml');
    const svgObj = resXML.getElementsByClassName('tank')[0];
    console.log(svgObj);
    tankGraphic = svgObj;
}

async function RefreshGame(){
    await LoadGameConfiguration();

}