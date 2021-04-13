var gameInfo = {
    "provinceInfo":{},
    "nationInfo":{},
    "turnNumb":-1,
    "deadline": "01 September 1939 12:00 GMT",
    "focused":false,
    "lastFocused":"",
    "turnComplete":false,
    "playingAs":"spectator",
    "queuedMoves":{}
}
let allProvIDs = [];
var enabledProvinces = [];
var tankGraphic = null;
var starGraphic = null;
let instantiatedTanks = {}
let instantiatedStars = {}
let instantiatedPlans = {}
const baseURL = window.origin;
const gameName = window.location.pathname.split('/').pop();

document.addEventListener('authComplete', function(){
    SetupGame(firebase.auth().currentUser.uid);
});

document.addEventListener('noAuth', function(){
    SetupGame();
});
async function SetupGame(authUID = null){
    await LoadGameConfiguration(authUID);
    await LoadMap();
    await LoadTankGraphic();
    await LoadStarGraphic();
    ApplyConfiguration();
    EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
    if(gameInfo.turnNumb < 1){
        RevealSubmenu('PreGame');
    }
}

function ApplyConfiguration(){
    for(provID in instantiatedTanks){
        if(gameInfo.provinceInfo[provID].owner != instantiatedTanks[provID].owner){
            instantiatedTanks[provID].ref.parentNode.removeChild(instantiatedTanks[provID].ref)
        }
    }

    gameInfo.keyProvinces.forEach(provID => {
        console.log(`${provID} is a key province`)      
        let pathReference = document.getElementById(provID);
        let pathRect = pathReference.getBBox();
        let [centerX, centerY] = [gameInfo.provinceInfo[provID].tokenLocation.x, gameInfo.provinceInfo[provID].tokenLocation.y];
        let starInstance = starGraphic.cloneNode(deep=true);
        starInstance.setAttribute('x',`${centerX - (starGraphic.getAttribute("width")/2)}`)
        starInstance.setAttribute('y',`${centerY - (starGraphic.getAttribute("height")/2)}`)
        pathReference.parentElement.appendChild(starInstance);
    });

    for(nationID in gameInfo.nationInfo){
        gameInfo.nationInfo[nationID].provinces.forEach(provID => {            
            UpdateMap(gameInfo.nationInfo[nationID].color, provID);
            let pathReference = document.getElementById(provID);
            let pathRect = pathReference.getBBox();
            let [centerX, centerY] = [pathRect.x + pathRect.width/2, pathRect.y + pathRect.height/2];
            if (gameInfo.provinceInfo[provID].troopPresence){
                let tankInstance = tankGraphic.cloneNode(deep=true);
                tankInstance.setAttribute('x',`${centerX - (tankGraphic.getAttribute("width")/2)}`);
                tankInstance.setAttribute('y',`${centerY - (tankGraphic.getAttribute("height")/2)}`);
                tankInstance.style.fill = gameInfo.nationInfo[nationID].color;
                let instantiatedGraphic = pathReference.parentElement.appendChild(tankInstance);
                instantiatedTanks[provID] = {'ref':instantiatedGraphic, 'owner':nationID};
            }
        });
    }
}

function EnableProvinces(provIDs, includingWater = true){
    enabledProvinces = [];
    enabledProvinces = [...provIDs];
    const svgObj = document.getElementById('gameMap');
    provIDs.forEach(provID => {
        const pathReference = document.getElementById(provID);
        if(pathReference.classList.contains('land') || (includingWater == pathReference.classList.contains('ocean'))){
            pathReference.classList.add('enabledProvince');
        }
    });
}

function BringGraphicsToFront(){
    const svgObj = document.getElementById('gameMap');
    for(provID in instantiatedTanks){
        svgObj.removeChild(instantiatedTanks[provID].ref);
        svgObj.append(instantiatedTanks[provID].ref)
    }
}

function DisableProvinces(provIDs){
    const svgObj = document.getElementById('gameMap');
    provIDs.forEach(provID => {
        if(!gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID)){
            const pathReference = document.getElementById(provID);
            pathReference.classList.remove('enabledProvince');
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
    console.log([color, provID]);
    const element = document.getElementById(provID);
    element.style.fill = color;
}


async function ProvinceSelect(provID){
    if(!gameInfo.focused){
        if(gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID) && gameInfo.provinceInfo[provID].troopPresence){
            let action = (await RevealSubmenu('actionMenu', ['Attack', 'Support Defense', 'Support Attack']))
            console.log(action);
            gameInfo.queuedMoves[provID] = {"moveType": action};
            switch(action){
                case 'Support Attack':
                    let supporting = (await RevealSubmenu('actionMenu', [...Object.keys(gameInfo.nationInfo)]))
                    gameInfo.queuedMoves[provID].supporting = supporting;
                case 'Attack':
                    FocusProvince(provID,false);
                    break;
                case 'Support Defense':
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
            if(Object.keys(instantiatedPlans).includes(gameInfo.lastFocused)){
                instantiatedPlans[gameInfo.lastFocused].remove()
                delete instantiatedPlans[gameInfo.lastFocused]
            }
            Drawline(gameInfo.lastFocused, provID);
        }else{
            delete gameInfo.queuedMoves[gameInfo.lastFocused];
            if(Object.keys(instantiatedPlans).includes(gameInfo.lastFocused)){
                instantiatedPlans[gameInfo.lastFocused].remove()
                delete instantiatedPlans[gameInfo.lastFocused]
            }
        }
        UpdateSendActionButtonStatus();
        ResetFocus();
        DisableProvinces(gameInfo.provinceInfo[gameInfo.lastFocused].neighbors);
        gameInfo.focused = false;
        EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces, false);
    }
}

function Drawline(fromProv, toProv){
    var newLine = document.createElementNS('http://www.w3.org/2000/svg','line');
            newLine.setAttribute('id','line2');
            newLine.setAttribute('x1', gameInfo.provinceInfo[fromProv].tokenLocation.x);
            newLine.setAttribute('y1',gameInfo.provinceInfo[fromProv].tokenLocation.y);
            newLine.setAttribute('x2',gameInfo.provinceInfo[toProv].tokenLocation.x);
            newLine.setAttribute('y2',gameInfo.provinceInfo[toProv].tokenLocation.y);
            newLine.setAttribute("stroke-width", "3px")
            newLine.setAttribute("stroke", gameInfo.nationInfo[gameInfo.playingAs].color)
            newLine.setAttribute("marker-end", "url(#arrow)");
            document.getElementById('gameMap').append(newLine);
            instantiatedPlans[fromProv] = newLine;
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