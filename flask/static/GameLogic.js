var gameInfo = {
    "provinceInfo":{},
    "nationInfo":{},
    "turnNumb":-1,
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
    if(authUID){
        PopulateChatOptions();
        if(gameInfo.lockStep){
            SetupLockConditions();
        }else{
            EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
        }
    }
    if(gameInfo.turnNumb < 1){
        RevealSubmenu('PreGame');
    }
}

async function RefreshGame(authUID = null){
    DismissSubmenu();
    await LoadGameConfiguration(authUID);
    for(prov in instantiatedPlans){
        instantiatedPlans[prov].remove()
        delete instantiatedPlans[prov]
    }
    for(prov in instantiatedTanks){
        instantiatedTanks[prov]['ref'].remove()
        delete instantiatedTanks[prov]
    }
    ApplyConfiguration();
    
    gameInfo.queuedMoves = {}
}

function SetupLockConditions(){
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
            console.log('checking')
            gameInfo.lockCondition.deploy.value = (gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length == gameInfo.nationInfo[gameInfo.playingAs].score)
            console.log(gameInfo.lockCondition.deploy.value);
            Checklock();
            },
            'value':(eligibleProvs.length == 0),
            'resolution':function(){DisableProvinces(eligibleProvs)}
        }
    }else if(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length > gameInfo.nationInfo[gameInfo.playingAs].score){
        EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed);

        gameInfo.lockCondition.delete = {'checker': function(){
            gameInfo.lockCondition.delete.value = (gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length == gameInfo.nationInfo[gameInfo.playingAs].score)
            Checklock();
        },
            'value':false,
            'resolution':function(){DisableProvinces(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed)}
        }
    }
}

function Checklock(){
    for(key in gameInfo.lockCondition){
        console.log('servicing' + key);
        if(gameInfo.lockCondition[key].value == true){
            console.log('true');
            if(gameInfo.lockCondition[key].resolution){
                gameInfo.lockCondition[key].resolution();
                console.log('resolved')
            }
            delete gameInfo.lockCondition[key];
        }
    }
    if(Object.keys(gameInfo.lockCondition).length == 0){
        console.log('getting button');
        UpdateSendActionButtonStatus();
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
        //console.log(`${provID} is a key province`)      
        let pathReference = document.getElementById(provID);
        let [centerX, centerY] = [Number(gameInfo.provinceInfo[provID].tokenLocation.x), Number(gameInfo.provinceInfo[provID].tokenLocation.y)];
        let starInstance = starGraphic.cloneNode(deep=true);
        pathReference.parentElement.appendChild(starInstance);
        //console.log(starInstance.getBoundingClientRect());
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
    provIDs.forEach(provID => {
        const pathReference = document.getElementById(provID);
        console.log(pathReference);
        if(pathReference.classList.contains('land') || (includingWater == pathReference.classList.contains('ocean'))){
            console.log('come again?');
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
    enabledProvinces = enabledProvinces.filter(provID => (provIDs.includes(provID) == false))
    provIDs.forEach(provID => {
        console.log('disabling ' + provID);
            const pathReference = document.getElementById(provID);
            pathReference.classList.remove('enabledProvince');

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
    //console.log([color, provID]);
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
                            DisableProvinces([provID])
                            gameInfo.nationInfo[gameInfo.playingAs].defeats = gameInfo.nationInfo[gameInfo.playingAs].defeats.filter(prov => prov != provID)
                            gameInfo.lockCondition.retreat.checker();
                            break;
                    }
                }else if(gameInfo.nationInfo[gameInfo.playingAs].cores.includes(provID)){
                    let action = (await RevealSubmenu('actionMenu', ['Confirm', 'Cancel']))
                    if(action=='Confirm'){
                        let pathReference = document.getElementById(provID);
                        let [centerX, centerY] = [Number(gameInfo.provinceInfo[provID].tokenLocation.x), gameInfo.provinceInfo[provID].tokenLocation.y];
                        var tankInstance = tankGraphic.cloneNode(deep=true);
                        let instantiatedGraphic = pathReference.parentElement.appendChild(tankInstance);
                        let [height, width] = [instantiatedGraphic.getBoundingClientRect().height, instantiatedGraphic.getBoundingClientRect().width];
                        instantiatedGraphic.setAttribute('x',centerX - width/2)
                        instantiatedGraphic.setAttribute('y',centerY - height/2)
                        instantiatedGraphic.style.fill = gameInfo.nationInfo[gameInfo.playingAs].color;
                        gameInfo.queuedMoves[provID] = {'lockMove':'create'};
                        gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.push(provID);
                        DisableProvinces([provID]);
                        gameInfo.lockCondition.deploy.checker();
                    }
                }else{
                    let action = (await RevealSubmenu('actionMenu', ['Confirm', 'Cancel']))
                    if(action=='Confirm'){
                        gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed = gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.filter(prov => prov != provID);
                        gameInfo.queuedMoves[provID] = {'lockMove':'destroy'};
                        DisableProvinces([provID]);
                        gameInfo.lockCondition.delete.checker();
                    }
                }
            }
        }else{
                if(enabledProvinces.includes(provID) && provID != gameInfo.lastFocused){
                        gameInfo.queuedMoves[gameInfo.lastFocused] = {'lockMove':'retreat', 'destProv':provID};
                        gameInfo.nationInfo[gameInfo.playingAs].defeats = gameInfo.nationInfo[gameInfo.playingAs].defeats.filter(prov => prov != gameInfo.lastFocused)
                        DisableProvinces(enabledProvinces)

                        gameInfo.lockCondition.retreat.checker();
                        gameInfo.lockFocus = null;
                        ResetFocus();
                        Drawline(gameInfo.lastFocused, provID);
                        if(gameInfo.lockCondition.deploy){
                            EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].cores.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && provID != prov));
                        }
                        if(gameInfo.nationInfo[gameInfo.playingAs].cores.includes(provID)){
                            gameInfo.nationInfo[gameInfo.playingAs].score -= 1;
                            gameInfo.lockCondition.deploy.checker()
                            if (gameInfo.lockCondition.deploy){
                                
                            }
                        }
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