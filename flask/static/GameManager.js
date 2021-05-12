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
    gameInfo = await LoadGameConfiguration(authUID, gameInfo);
    console.log(gameInfo.mapType);
    await LoadMap(gameInfo.mapType, gameInfo.provinceInfo);
    await LoadTankGraphic();
    await LoadStarGraphic();
    ConnectSocket(gameName);
    SetupMapLayout(gameInfo.keyProvinces, gameInfo.provinceInfo);
    ApplyConfiguration(gameInfo.nationInfo, gameInfo.provinceInfo);
    if(gameInfo.turnNumb < 1){
        EnablePregame();
        RevealOverlay();
    }
}

async function RefreshGame(){
    console.log("Game should be refreshing");
    DismissOverlay();
    EnableActions();
    ResetFocus();
    gameInfo.lastFocused = null;
    gameInfo = await LoadGameConfiguration(authUID, gameInfo);
    for(prov in instantiatedPlans){
        instantiatedPlans[prov].ref.remove()
        delete instantiatedPlans[prov]
    }
    planDestinations = []
    ApplyConfiguration(gameInfo.nationInfo, gameInfo.provinceInfo);
    gameInfo.queuedMoves = {}
}

function SetupLockConditions(){
    DisableProvinces(enabledProvinces);
    var totalTroops = gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.length;
    for (provID in gameInfo.nationInfo[gameInfo.playingAs]){
        if (instantiatedDefeats[provID]){
            console.log('defeat at ' + provID);
            totalTroops++;
        }else{
            console.log('provID was deleted');
        }
    }
    console.log('troop count is ' + totalTroops);

    //filter out provinces that don't have anywhere to retreat to
    //let eligibleProvs = gameInfo.nationInfo[gameInfo.playingAs].defeats.filter(provID => gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs).length > 0)
    //player's did not react nicely to having decisions made for them
    //even if it's the only available choice...
    EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].defeats, true);

    if(totalTroops < gameInfo.nationInfo[gameInfo.playingAs].score){
        //filter out occupied and conquered cores as well as cores being retreated to 
        let eligibleProvs = gameInfo.nationInfo[gameInfo.playingAs].cores.filter(provID => gameInfo.provinceInfo[provID].owner == gameInfo.playingAs && !gameInfo.provinceInfo[provID].troopPresence && !planDestinations.includes(provID))   
        console.log(eligibleProvs.length + ' eligible provinces to be spawned in');
        EnableProvinces(eligibleProvs, true);
    }else if(totalTroops > gameInfo.nationInfo[gameInfo.playingAs].score){
        //Player must pick a troop to destroy (can also be a retreating one)
        console.log('sorry what, ' + totalTroops + ' > ' + gameInfo.nationInfo[gameInfo.playingAs].score);
        EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed, true);
    }
}

function AddTerritoryToNation(nationID, provID){        
    gameInfo.nationInfo[nationID].provinces.push(provID);
    if (gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner]){
        gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner].provinces = gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner].provinces.filter(function(ele){ 
            return ele != provID; 
        });
    }
    gameInfo.provinceInfo[provID].owner = nationID;
    UpdateProvince(gameInfo.nationInfo[nationID].color,provID);
}

function UpdateSendActionButtonStatus(){
    let state = (Object.keys(gameInfo.queuedMoves).length > 0) ? 'flex':'none';
    document.getElementById('sendOrdersButton').style.display = state;
}

function DestroyTroop(provID){
    instantiatedTanks[provID].remove();
    gameInfo.provinceInfo[provID].troopPresence = null;
    gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed = gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.filter(prov => provID != prov)
    DeleteTroopToken(provID)
}


function FocusProvince(provID, specificNeighbors = false){
    gameInfo.focused = true;
    gameInfo.lastFocused = provID;
    let allProvs = [...document.getElementsByClassName('province')];

    let whiteList = (specificNeighbors === false)?gameInfo.provinceInfo[provID].neighbors:specificNeighbors;
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

