var gameInfo = {
    "provinceInfo":{},
    "nationInfo":{},
    "inputMode":"",
    "focusedProv":"",
    "desiredNation":""
}
let allProvIDs = [];
var enabledProvinces = [];
var tankGraphic = null;
var starGraphic = null;
let instantiatedTanks = {}
let instantiatedStars = {}
const baseURL = window.origin;
const gameName = window.location.pathname.split('/').pop();

window.onload = function(){
    SetupGame();
}
async function SetupGame(authUID = null){
    console.log('hello?');
    await LoadGameConfiguration(authUID);
    await LoadMap();
    await LoadStarGraphic();
    await LoadTankGraphic();    
    ApplyConfiguration();
    BringGraphicsToFront();
    EnableProvinces(allProvIDs);
}

async function LoadGameConfiguration(auth){
    let gameName = window.location.pathname.split('/')[2];
    resJSON = JSON.parse(await ResourceRequest(baseURL +  '/game/' + gameName + '/data'));
    console.log(resJSON);
    if(gameInfo.turnNumb != resJSON.turnNumb){
        gameInfo = {...gameInfo, ...resJSON};
    }
    
}

async function LoadMap() {
    console.log(baseURL + '/mapResources/' + gameInfo.mapType);
    let req = await ResourceRequest(baseURL + '/mapResources/' + gameInfo.mapType);
    const resXML = new DOMParser().parseFromString(req, 'image/svg+xml');
    const wrapperGroup = document.createElementNS("http://www.w3.org/2000/svg","g");
    const svgObj = resXML.getElementById('gameMap');
    svgObj.querySelectorAll('#gameMap > path').forEach(element => {
        const provID = element.getAttribute('id');
        allProvIDs.push(provID)
        console.log(element);
        element.removeAttribute('style');
        element.classList.add('province');
        if(element.getAttribute("id").split('_').length < 2){
            element.classList.add('land');
        }else{
            element.classList.add('ocean');
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
        tankGraphic.style.pointerEvents = "none";
    }
    async function LoadStarGraphic(){
        const resXML = new DOMParser().parseFromString(await ResourceRequest(baseURL + '/star'), 'image/svg+xml');
        const svgObj = resXML.getElementById('star');
        console.log(svgObj);
        starGraphic = svgObj;
        starGraphic.style.pointerEvents = "none";
    }

function RelayerMap(){
    for(provID in instantiatedTanks){
        BringProvToFront(provID);
    }
    gameInfo.keyProvinces.forEach(provID => {
        BringProvToFront(provID);
    });
}

//CHANGES TO THIS FUNCTION
function ApplyConfiguration(){
    for(provID in instantiatedTanks){
        if(gameInfo.provinceInfo[provID].owner != instantiatedTanks[provID].owner){
            instantiatedTanks[provID].ref.parentNode.removeChild(instantiatedTanks[provID].ref)
        }
    }

    allProvIDs.forEach(provID => {
        console.log(`${provID} is a key province`)     
        if  (gameInfo.provinceInfo[provID]){
        let pathReference = document.getElementById(provID);
        let pathRect = pathReference.getBBox();
        let [centerX, centerY] = [pathRect.x + pathRect.width/2, pathRect.y + pathRect.height/2];
        let starInstance = starGraphic.cloneNode(deep=true);
        starInstance.setAttribute('x',`${centerX - (starGraphic.getAttribute("width")/2)}`)
        starInstance.setAttribute('y',`${centerY - (starGraphic.getAttribute("height")/2)}`)
        gameInfo.provinceInfo[provID].tokenLocation = {'x': centerX, 'y':centerY};
        instantiatedStars[provID] = starInstance;
        pathReference.parentElement.appendChild(starInstance);
    }
    });

    for(nationID in gameInfo.nationInfo){
        gameInfo.nationInfo[nationID].provinces.forEach(provID => {            
            UpdateMap(nationID, provID);
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

function EnableProvinces(provIDs){
    enabledProvinces = [];
    enabledProvinces = [...provIDs];
    const svgObj = document.getElementById('gameMap');
    provIDs.forEach(provID => {
        const pathReference = document.getElementById(provID);
        pathReference.classList.add('enabledProvince');
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
    console.log('does this ever happen?');
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
    UpdateMap(nationID, provID);
}

function UpdateMap(newNationID, provID){
        const element = document.getElementById(provID);
        let oldNation = gameInfo.provinceInfo[provID].owner;
        if (oldNation in gameInfo.nationInfo){
            gameInfo.nationInfo[oldNation].provinces = gameInfo.nationInfo[oldNation].provinces.filter(prov => prov != provID); 
            console.log(provID + ' removed from ' + oldNation);
        } 
        if(newNationID in gameInfo.nationInfo){
            element.style.fill = gameInfo.nationInfo[newNationID].color;
            gameInfo.provinceInfo[provID].owner = newNationID;
            gameInfo.nationInfo[newNationID].provinces.push(provID);
            console.log(provID + ' added to ' + newNationID);
        }else{
            element.style.fill = '';
        }
}

async function ChangeInputMode(){
    ResetFocus();
    EnableProvinces(allProvIDs);
    gameInfo.inputMode = await RevealSubmenu('actionMenu', ['territory', 'neighbors']);
    if (gameInfo.inputMode == 'territory'){
        gameInfo.desiredNation = await RevealSubmenu('actionMenu', [...Object.keys(gameInfo.nationInfo), 'None'])
    }
}


async function ProvinceSelect(provID, rebase){
    console.log(instantiatedStars[provID]);
    if(!(provID in gameInfo.provinceInfo)){
        gameInfo.provinceInfo[provID] = {
            "owner":null,
            "neighbors":[],
            "troopPresence":false
        };
    }
    if(gameInfo.inputMode == 'territory'){
        UpdateMap(gameInfo.desiredNation, provID);
    }else if(gameInfo.inputMode == "neighbors"){
        if (rebase){
            ResetFocus();
            FocusProvince(provID);
        }else{
            EditProvinceNeighbor(provID);
        }
    }
}

function EditProvinceNeighbor(neighborID){
    if(neighborID == gameInfo.focusedProv){
        console.log('A province can\'t neighbor itself, dipshit');
        return;
    }
    if(gameInfo.provinceInfo[gameInfo.focusedProv].neighbors.includes(neighborID)){
        gameInfo.provinceInfo[gameInfo.focusedProv].neighbors = gameInfo.provinceInfo[gameInfo.focusedProv].neighbors.filter(prov => prov != neighborID);
        console.log(neighborID + ' is no longer a neighbor of ' + gameInfo.focusedProv);
    }else{
        gameInfo.provinceInfo[gameInfo.focusedProv].neighbors.push(neighborID);
        console.log(neighborID + ' is now a neighbor of ' + gameInfo.focusedProv);
    }
    FocusProvince(gameInfo.focusedProv);
}

function FocusProvince(provID){
    gameInfo.focusedProv = provID;
    let allProvs = [...document.getElementsByClassName('province')];
    let whiteList = [...gameInfo.provinceInfo[provID].neighbors];
    whiteList.push(provID);
    allProvs.forEach(e => {
        if(e.getAttribute('id') != provID){
            e.classList.add("disabledProvince");
            e.classList.remove("enabledProvince")
        }
    });
    EnableProvinces(whiteList);
}

function ResetFocus(){
    let allProvs = [...document.getElementsByClassName('province')];
    allProvs.forEach(e => {
        e.classList.remove("disabledProvince");
    });
}

function ExportJson(){
    var blob = new Blob([JSON.stringify({'nationInfo':gameInfo.nationInfo, 'provinceInfo':gameInfo.provinceInfo})], {type: 'text/plain'});
    var url = window.URL.createObjectURL(blob);
    let temp = document.createElement('a');
    temp.href = url;
    temp.download = 'export.json';
    temp.click();
}