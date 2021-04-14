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
let instantiatedDefeats = {}
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
    if(gameInfo.lockStep){
        gameInfo.lockCondition = {}
        if(gameInfo.nationInfo[gameInfo.playingAs].defeats.length > 0){
            //filter out provinces that don'n have anywhere to retreat to
            let eligibleProvs = gameInfo.nationInfo[gameInfo.playingAs].defeats.filter(provID => gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs).length > 0)
            gameInfo.nationInfo[gameInfo.playingAs].defeats = eligibleProvs;
            console.log('eligible retreats:');
            console.log(eligibleProvs);
            EnableProvinces(eligibleProvs);
            gameInfo.lockCondition.retreat = {'checker': function(){
                gameInfo.lockCondition.retreat.value = (gameInfo.nationInfo[gameInfo.playingAs].defeats.length == 0)
                Checklock();
            },
                'value':(eligibleProvs.length == 0)
            }
        }
        if(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length < gameInfo.nationInfo[gameInfo.playingAs].score){
            //filter out occupied and conquered cores
            let eligibleProvs = gameInfo.nationInfo[gameInfo.playingAs].cores.filter(provID => gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID) && gameInfo.provinceInfo[provID].troopPresence == false);
            EnableProvinces(eligibleProvs);
            gameInfo.lockCondition.deploy = {'checker': function(){
                gameInfo.lockCondition.deploy.value = (gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length == gameInfo.nationInfo[gameInfo.playingAs].score)
                Checklock();
                },
                'value':(eligibleProvs.length == 0),
                'resolution':DisableProvinces(eligibleProvs)
            }
        }else if(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length > gameInfo.nationInfo[gameInfo.playingAs].score){
            EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed);
            gameInfo.lockCondition.delete = {'checker': function(){
                gameInfo.lockCondition.delete.value = (gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length == gameInfo.nationInfo[gameInfo.playingAs].score)
                Checklock();
            },
                'value':false,
                'resolution':DisableProvinces(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed)
            }
        }
        //
        if(Object.keys(gameInfo.lockCondition).length == 0){
            console.log('All good here');;
        }
    }else{
        EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
       
    }
    if(gameInfo.turnNumb < 1){
        RevealSubmenu('PreGame');
    }
}

function Checklock(){
    for(key in gameInfo.lockStep){
        if(gameInfo.lockCondition[key].value == true){
            delete gameInfo.lockCondition[key];
        }
    }
    
}

function ApplyConfiguration(){
    for(provID in instantiatedTanks){
        if(gameInfo.provinceInfo[provID].owner != instantiatedTanks[provID].owner){
            instantiatedTanks[provID].ref.parentNode.removeChild(instantiatedTanks[provID].ref)
            console.log('is this even possible?');
        }
    }

    gameInfo.keyProvinces.forEach(provID => {
        console.log(`${provID} is a key province`)      
        let pathReference = document.getElementById(provID);
        let [centerX, centerY] = [Number(gameInfo.provinceInfo[provID].tokenLocation.x), Number(gameInfo.provinceInfo[provID].tokenLocation.y)];
        let starInstance = starGraphic.cloneNode(deep=true);
        pathReference.parentElement.appendChild(starInstance);
        console.log(starInstance.getBoundingClientRect());
        let [height, width] = [starInstance.getBoundingClientRect().height, starInstance.getBoundingClientRect().width];
        starInstance.setAttribute('x',centerX - width/2)
        starInstance.setAttribute('y',centerY - height/2)
        
    });

    for(nationID in gameInfo.nationInfo){
        gameInfo.nationInfo[nationID].provinces.forEach(provID => {            
            UpdateMap(gameInfo.nationInfo[nationID].color, provID);
            let pathReference = document.getElementById(provID);
            
            if (gameInfo.provinceInfo[provID].troopPresence){
                let [centerX, centerY] = [Number(gameInfo.provinceInfo[provID].tokenLocation.x), gameInfo.provinceInfo[provID].tokenLocation.y];
                var tankInstance = tankGraphic.cloneNode(deep=true);
                let instantiatedGraphic = pathReference.parentElement.appendChild(tankInstance);
                let [height, width] = [instantiatedGraphic.getBoundingClientRect().height, instantiatedGraphic.getBoundingClientRect().width];
                instantiatedGraphic.setAttribute('x',centerX - width/2)
                instantiatedGraphic.setAttribute('y',centerY - height/2)
                instantiatedTanks[provID] = {'ref':instantiatedGraphic, 'owner':nationID};
                instantiatedGraphic.style.fill = gameInfo.nationInfo[nationID].color;
                gameInfo.provinceInfo[provID].owner = nationID;

            }
        });
        gameInfo.nationInfo[nationID].defeats.forEach(provID => {
            console.log(nationID + " | " + provID);
            let pathReference = document.getElementById(provID);
            let [centerX, centerY] = [Number(gameInfo.provinceInfo[provID].tokenLocation.x), Number(gameInfo.provinceInfo[provID].tokenLocation.y)];
            var tankInstance = tankGraphic.cloneNode(deep=true);
            instantiatedDefeats[provID] = pathReference.parentElement.appendChild(tankInstance);
            let [height, width] = [instantiatedDefeats[provID].getBoundingClientRect().height, instantiatedDefeats[provID].getBoundingClientRect().width];
            
            instantiatedDefeats[provID].setAttribute('x',(centerX + width/3));
            instantiatedDefeats[provID].setAttribute('y',(centerY + height/3));
            instantiatedDefeats[provID].setAttribute('height',22);
            instantiatedDefeats[provID].setAttribute('width',22);
            
            instantiatedDefeats[provID].style.fill = gameInfo.nationInfo[nationID].color;
            instantiatedDefeats[provID].children[0].style.fill = 'gray';
            
            console.log(instantiatedDefeats[provID]);
        });
    }
}

function EnableProvinces(provIDs, includingWater = true){
    enabledProvinces = enabledProvinces.concat(provIDs);
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
    enabledProvinces = enabledProvinces.filter(provID => (provIDs.includes(provID) == false))
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
    if(gameInfo.lockStep == false){
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
                        FocusProvince(provID,gameInfo.provinceInfo[provID].neighbors.filter(prov => (gameInfo.provinceInfo[prov].troopPresence)));
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
    }else{
        if(gameInfo.lockFocus == null){
            if(enabledProvinces.includes(provID)){
                if(gameInfo.nationInfo[gameInfo.playingAs].defeats.includes(provID)){
                    let action = (await RevealSubmenu('actionMenu', ['Retreat', 'Destroy']))
                    switch (action) {
                        case 'Retreat':
                            console.log(gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs));
                            FocusProvince(provID, gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs));
                            gameInfo.lastFocused = provID;
                            gameInfo.lockFocus = true;
                            break;
                        case 'Destroy':
                            console.log('de_stroyed');
                            break;
                    }



                }
            }
        }else{
                if(provID != gameInfo.lastFocused){
                        gameInfo.queuedMoves[gameInfo.lastFocused] = {'lockMove':'retreat', 'destProv':provID};
                        gameInfo.nationInfo[gameInfo.playingAs].defeats.filter(prov => prov != provID)
                        gameInfo.lockCondition.retreat.checker();
                        gameInfo.lockFocus = null;
                        ResetFocus();
                        Drawline(gameInfo.lastFocused, provID);
                    }
            }
        }
}

function Drawline(fromProv, toProv){
    var newLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    newLine.setAttribute('id','line2');
    console.log(Number(gameInfo.provinceInfo[fromProv].tokenLocation.x));
    console.log(Number(gameInfo.provinceInfo[fromProv].tokenLocation.y));
    newLine.setAttribute('x1', Number(gameInfo.provinceInfo[fromProv].tokenLocation.x));
    newLine.setAttribute('y1', Number(gameInfo.provinceInfo[fromProv].tokenLocation.y));
    newLine.setAttribute('x2',gameInfo.provinceInfo[toProv].tokenLocation.x);
    newLine.setAttribute('y2',gameInfo.provinceInfo[toProv].tokenLocation.y);
    newLine.setAttribute("stroke-width", "3px")
    newLine.setAttribute("stroke", gameInfo.nationInfo[gameInfo.playingAs].color)
    newLine.setAttribute("marker-end", "url(#arrow)");
    document.getElementById('gameMap').append(newLine);
    instantiatedPlans[fromProv] = newLine;
}

function FocusProvince(provID, specificNeighbors = false){
    const allProvs = [...document.getElementsByClassName('province')];

    let whiteList = (specificNeighbors == false)?gameInfo.provinceInfo[provID].neighbors:specificNeighbors;
    if(specificNeighbors){
        console.log(specificNeighbors);
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