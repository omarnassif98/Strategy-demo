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
var authUID = null;
let allProvIDs = [];
var enabledProvinces = [];
var tankGraphic = null;
var starGraphic = null;
let instantiatedTanks = {}
let instantiatedStars = {}
let instantiatedPlans = {}
let planDestinations = []
let instantiatedDefeats = {}
const baseURL = window.origin;
const gameName = window.location.pathname.split('/').pop();

document.addEventListener('authComplete', function(){
    (async() => {
    authUID = firebase.auth().currentUser.uid;
    await SetupGame();
    PopulateChatOptions();
    })();
});

document.addEventListener('noAuth', function(){
    SetupGame();
});

async function SetupGame(){
    await LoadGameConfiguration(authUID);
    await LoadMap();
    await LoadTankGraphic();
    await LoadStarGraphic();
    SetupMapLayout();
    ApplyConfiguration();
    if(gameInfo.turnNumb < 1){
        EnablePregame();
        RevealOverlay();
    }
}

async function RefreshGame(){
    console.log("Game should be refreshing");
    DismissOverlay();
    EnableActions();
    gameInfo.lastFocused = null;
    await LoadGameConfiguration(authUID);
    for(prov in instantiatedPlans){
        instantiatedPlans[prov].ref.remove()
        delete instantiatedPlans[prov]
    }
    planDestinations = []
    ApplyConfiguration();
    gameInfo.queuedMoves = {}
}

function SetupLockConditions(){
    gameInfo.lockFocus = false;
    let totalTroops = gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length + gameInfo.nationInfo[gameInfo.playingAs].defeats.length;
    
    //filter out provinces that don't have anywhere to retreat to
    //let eligibleProvs = gameInfo.nationInfo[gameInfo.playingAs].defeats.filter(provID => gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs).length > 0)
    //player's did not react nicely to having decisions made for them
    //even if it's the only available choice...
    EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].defeats, true);

    if(totalTroops < gameInfo.nationInfo[gameInfo.playingAs].score){
        //filter out occupied and conquered cores as well as cores being retreated to 
        let eligibleProvs = gameInfo.nationInfo[gameInfo.playingAs].cores.filter(provID => gameInfo.provinceInfo[provID].owner == gameInfo.playingAs && gameInfo.provinceInfo[provID].troopPresence == false && !planDestinations.includes(provID))   
        console.log(eligibleProvs.length + ' eligible provinces to be spawned in');
        EnableProvinces(eligibleProvs, true);
    }else if(totalTroops > gameInfo.nationInfo[gameInfo.playingAs].score){
        //Player must pick a troop to destroy (can also be a retreating one)
        EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed);
    }
}

function SetupMapLayout(){
    gameInfo.keyProvinces.forEach(provID => {    
        let pathReference = document.getElementById(provID);
        let [centerX, centerY] = [Number(gameInfo.provinceInfo[provID].tokenLocation.x), Number(gameInfo.provinceInfo[provID].tokenLocation.y)];
        let starInstance = starGraphic.cloneNode(deep=true);
        pathReference.parentElement.appendChild(starInstance);
        //console.log(starInstance.getBoundingClientRect());
        let [height, width] = [starInstance.getBoundingClientRect().height, starInstance.getBoundingClientRect().width];
        starInstance.setAttribute('x',centerX - width/2);
        starInstance.setAttribute('y',centerY - height/2); 
    });
}

function ApplyConfiguration(){
    console.log('Configuration is being applied');
    DisableProvinces(enabledProvinces);
    //Remove tanks from where they shouldn't be (previous positions after moves)
    for(provID in instantiatedTanks){
        DeleteTroop(provID);
    }
    for(provID in instantiatedDefeats){
        console.log('removing');
        DeleteDefeat(provID);
    }


    for(nationID in gameInfo.nationInfo){
        gameInfo.nationInfo[nationID].provinces.forEach(provID => UpdateMap(gameInfo.nationInfo[nationID].color, provID));
        gameInfo.nationInfo[nationID].defeats.forEach(provID => CreateDefeat(nationID, provID));
        gameInfo.nationInfo[nationID].troopsDeployed.forEach(provID => CreateTroop(nationID,provID));  
    }
    if(gameInfo.lockStep){
        DisableProvinces(enabledProvinces);
        SetupLockConditions();
    }else if(gameInfo.playingAs){
        EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
    }
}

function CreateDefeat(nationID, provID){
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
}

function CreateTroop(nationID, provID){
    let pathReference = document.getElementById(provID);
    let [centerX, centerY] = [Number(gameInfo.provinceInfo[provID].tokenLocation.x), gameInfo.provinceInfo[provID].tokenLocation.y];
    var tankInstance = tankGraphic.cloneNode(deep=true);
    let instantiatedGraphic = pathReference.parentElement.appendChild(tankInstance);
    let [height, width] = [instantiatedGraphic.getBoundingClientRect().height, instantiatedGraphic.getBoundingClientRect().width];
    instantiatedGraphic.setAttribute('x',centerX - width/2)
    instantiatedGraphic.setAttribute('y',centerY - height/2)
    instantiatedTanks[provID] = instantiatedGraphic;
    instantiatedGraphic.style.fill = gameInfo.nationInfo[nationID].color;
    gameInfo.provinceInfo[provID].owner = nationID;
}

function EnableProvinces(provIDs, append = false){
    enabledProvinces = append ? [...enabledProvinces, ...provIDs]:[...provIDs];
    provIDs.forEach(provID => {
        const pathReference = document.getElementById(provID);
        pathReference.classList.add('enabledProvince');    
    });
}

function BringGraphicsToFront(){
    const svgObj = document.getElementById('gameMap');
    for(provID in instantiatedTanks){
        svgObj.removeChild(instantiatedTanks[provID]);
        svgObj.append(instantiatedTanks[provID])
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
    document.getElementById('sendOrdersButton').style.display = state;
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
                let action = (await RevealActionMenu('Choose an action', ['Attack', 'Support Defense', 'Support Attack']))
                console.log(action);
                gameInfo.queuedMoves[provID] = {"moveType": action};
                switch(action){
                    case 'Support Attack':
                        let supporting = (await RevealActionMenu('Who to support?', [...Object.keys(gameInfo.nationInfo)]))
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
            if(Object.keys(instantiatedPlans).includes(gameInfo.lastFocused)){
                DeletePlan(gameInfo.lastFocused);
            }

            if(enabledProvinces.includes(provID) && provID != gameInfo.lastFocused){
                gameInfo.queuedMoves[gameInfo.lastFocused].destProv = provID;   
                Drawline(gameInfo.lastFocused, provID);
            }else{
                delete gameInfo.queuedMoves[gameInfo.lastFocused];
            }
            UpdateSendActionButtonStatus();
            ResetFocus();
            DisableProvinces(gameInfo.provinceInfo[gameInfo.lastFocused].neighbors);
            gameInfo.focused = false;
            EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
        }
    }else{
        if(gameInfo.lockFocus == false){
            if(enabledProvinces.includes(provID)){
                if(gameInfo.nationInfo[gameInfo.playingAs].defeats.includes(provID)){
                    let action = (await RevealActionMenu(provID + ' has been overrun', ['Retreat', 'Destroy']))
                    switch (action) {
                        case 'Retreat':
                            console.log(gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs));
                            FocusProvince(provID, gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs));
                            gameInfo.lastFocused = provID;
                            gameInfo.lockFocus = true;

                            break;
                        case 'Destroy':
                            if(Object.keys(instantiatedPlans).includes(provID)){
                                DeletePlan(provID);
                            }
                            console.log('de_stroyed');
                            DeleteDefeat(provID);
                            SetupLockConditions();
                            gameInfo.queuedMoves[provID] = {'lockMove':'cull'};

                            break;
                    }
                }else if(gameInfo.nationInfo[gameInfo.playingAs].cores.includes(provID)){
                    let action = (await RevealActionMenu('Create Troop in ' + provID + '?', ['Confirm', 'Cancel']))
                    if(action=='Confirm'){
                        CreateTroop(gameInfo.playingAs, provID);
                        gameInfo.queuedMoves[provID] = {'lockMove':'create'};
                        gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.push(provID);
                        DisableProvinces(enabledProvinces);
                    }
                }else{
                    let action = (await RevealActionMenu('actionMenu', ['Confirm', 'Cancel']))
                    if(action=='Confirm'){
                        gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed = gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.filter(prov => prov != provID);
                        
                        gameInfo.queuedMoves[provID] = {'lockMove':'destroy'};

                    }
                }
            }
        }else{
            if(Object.keys(instantiatedPlans).includes(gameInfo.lastFocused)){
                DeletePlan(gameInfo.lastFocused);
            }else if(!Object.keys(instantiatedDefeats).includes(gameInfo.lastFocused)){
                CreateDefeat(gameInfo.playingAs, gameInfo.lastFocused);
            }
            if(enabledProvinces.includes(provID) && provID != gameInfo.lastFocused){
                    gameInfo.queuedMoves[gameInfo.lastFocused] = {'lockMove':'retreat', 'destProv':provID};
                    DisableProvinces(enabledProvinces)
                    gameInfo.lockFocus = null;
                    ResetFocus();
                    Drawline(gameInfo.lastFocused, provID);
                }
            }
        }
        SetupLockConditions();
        UpdateSendActionButtonStatus();
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
    instantiatedPlans[fromProv] = {}
    instantiatedPlans[fromProv].ref = newLine;
    instantiatedPlans[fromProv].destination = toProv;
    planDestinations.push(toProv);
}

function DeletePlan(provID){
    
    instantiatedPlans[provID].ref.remove();
    planDestinations = planDestinations.filter(prov => instantiatedPlans[provID].destination != prov);
    delete instantiatedPlans[provID];
}

function DeleteTroop(provID){
    instantiatedTanks[provID].remove();
    delete instantiatedTanks[provID];
}

function DeleteDefeat(provID){
    instantiatedDefeats[provID].remove();
    delete instantiatedDefeats[provID];
}
function FocusProvince(provID, specificNeighbors = false){
    let allProvs = [...document.getElementsByClassName('province')];

    let whiteList = (specificNeighbors === false)?gameInfo.provinceInfo[provID].neighbors:specificNeighbors;
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
    enabledProvinces.splice(0,enabledProvinces.length);
    EnableProvinces(whiteList);
}

function ResetFocus(){
    let allProvs = [...document.getElementsByClassName('province')];
    allProvs.forEach(e => {
            e.classList.remove("disabledProvince");
    });
}