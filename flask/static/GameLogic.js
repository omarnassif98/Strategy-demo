var gameInfo = {
    "provinceInfo":{},
    "nationInfo":{},
    "turnNumb":-1,
    "deadline": "01 September 1939 12:00 GMT",
    "focused":false,
    "lastFocused":"",
    "turnComplete":false,
    "playingAs":"ITA",
    "queuedMoves":{}
}
var enabledProvinces = [];
var tankGraphic = null;
const baseURL = window.origin;
const gameName = window.location.pathname.split('/').pop();
SetupGame();

async function SetupGame(){
    await LoadGameConfiguration();
    await LoadMap();
    await LoadTankGraphic();
    for(nationID in gameInfo.nationInfo){
        gameInfo.nationInfo[nationID].provinces.forEach(provID => {
            let pathReference = document.getElementById(provID);
            UpdateMap(gameInfo.nationInfo[nationID].color, provID);
            if (gameInfo.provinceInfo[provID].troopPresence){
                let tankInstance = tankGraphic.cloneNode(deep=true);
                let pathRect = pathReference.getBBox();
                let [centerX, centerY] = [pathRect.x + pathRect.width/2, pathRect.y + pathRect.height/2];
                tankInstance.setAttribute('x',`${centerX - (tankGraphic.getAttribute("width")/2)}`);
                tankInstance.setAttribute('y',`${centerY - (tankGraphic.getAttribute("height")/2)}`);
                tankInstance.style.fill = gameInfo.nationInfo[nationID].color;
                pathReference.parentElement.appendChild(tankInstance);
            }
        });
        
    }
    
    EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
}

async function LoadGameConfiguration(){
    let resJSON = JSON.parse(await ResourceRequest(baseURL +  '/game/' + gameName + '/mapData'));
    for(let key in resJSON){
        gameInfo[key] = {...resJSON[key]}
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

function EnableProvinces(provIDs){
    console.log(provIDs);
    enabledProvinces = [];
    enabledProvinces = [...provIDs];
    const svgObj = document.getElementById('gameMap');
    provIDs.forEach(provID => {
        const pathReference = document.getElementById(provID);
        pathReference.classList.add('enabledProvince');
        svgObj.removeChild(pathReference.parentElement);
        svgObj.appendChild(pathReference.parentElement);
    });
}
function DisableProvinces(provIDs){
    const svgObj = document.getElementById('gameMap');
    provIDs.forEach(provID => {
        if(!gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID)){
            const pathReference = document.getElementById(provID);
            pathReference.classList.remove('enabledProvince');
            svgObj.removeChild(pathReference.parentElement);
            svgObj.insertBefore(pathReference.parentElement, svgObj.firstChild)
    }
    });
}

function AddTerritoryToNation(nationID, provID){        
    gameInfo.nationInfo[nationID].provinces.push(provID);
    if (gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner]){
        gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner].provinces = gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner].provinces.filter(function(ele){ 
            return ele != provID; 
        });
    }
    gameInfo.provinceInfo[provID].owner = nationID;
    UpdateMap(gameInfo.nationInfo[nationID].color,provID);
}

function UpdateSendActionButtonStatus(){
    let state = (Object.keys(gameInfo.queuedMoves).length > 0) ? 'flex':'none';
    ChangeDisplayState(document.getElementById('sendOrdersButton'), state);
}

function UpdateMap(color, provID){
        const element = document.getElementById(provID);
        element.style.fill = color;
}


async function ProvinceSelect(provID){
    if(!gameInfo.focused){
        if(gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID) && gameInfo.provinceInfo[provID].troopPresence){
            let action = (await RevealSubmenu('actionMenu')).split(' ');
            console.log(action);
            gameInfo.queuedMoves[provID] = {"moveType": action[0]};
            switch(action[0]){
                case 'supportAtk':
                    gameInfo.queuedMoves[provID].supporting = action[1];
                case 'attack':
                    FocusProvince(provID,false);
                    break;
                case 'supportDfns':
                    FocusProvince(provID,true);
                    break;
                default:
                    delete gameInfo.queuedMoves[provID];
                    UpdateSendActionButtonStatus();
                    return;
            }
            gameInfo.focused = true;
            gameInfo.lastFocused = provID;
            
        }
    }else{
        
        if(enabledProvinces.includes(provID) && provID != gameInfo.lastFocused){
            gameInfo.queuedMoves[gameInfo.lastFocused].destProv = provID;
        }else{
            delete gameInfo.queuedMoves[gameInfo.lastFocused];
        }
        UpdateSendActionButtonStatus();
        ResetFocus();
        DisableProvinces(gameInfo.provinceInfo[gameInfo.lastFocused].neighbors);
        gameInfo.focused = false;
        EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
    }
}



function FocusProvince(provID, onlyTroops){
    const allProvs = [...document.getElementsByClassName('province')];
    let whiteList = gameInfo.provinceInfo[provID].neighbors;
    if(onlyTroops){
        whiteList = whiteList.filter(function(_provID){
            console.log(`${_provID} returns ${gameInfo.provinceInfo[_provID].troopPresence}`);
            return gameInfo.provinceInfo[_provID].troopPresence;
        });
    }
    whiteList.push(provID);
    allProvs.forEach(e => {
        if(!whiteList.includes(e.getAttribute('id'))){
            e.classList.add("disabledProvince");
            e.classList.remove("enabledProvince")
        }
    });
    
    EnableProvinces(whiteList);
}

function ResetFocus(){
    const allProvs = [...document.getElementsByClassName('province')];
    allProvs.forEach(e => {
            e.classList.remove("disabledProvince");
    });
}