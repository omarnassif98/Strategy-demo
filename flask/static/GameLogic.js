var gameInfo = {
    "provinceInfo":{},
    "nationInfo":{},
    "turnNumb":-1,
    "deadline": "01 September 1939 12:00 GMT",
    "focused":false,
    "lastFocused":"",
    "turnComplete":false,
    "playingAs":"ITA",
    "queuedMoves":[]
}
const baseURL = window.origin;
SetupGame();

async function SetupGame(){
    await LoadGameConfiguration();
    await LoadSVG();
    
    for(nationID in gameInfo.nationInfo){
        gameInfo.nationInfo[nationID].provinces.forEach(provID => UpdateMap(gameInfo.nationInfo[nationID].color, provID));
    }
    
    EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
}

function EnableProvinces(provIDs){
    const svgObj = document.getElementById('gameMap');
    provIDs.forEach(provID => {
        const pathReference = document.getElementById(provID);
        pathReference.classList.add('enabledProvince');
        svgObj.removeChild(pathReference);
        svgObj.appendChild(pathReference)
    });
}
function DisableProvinces(provIDs){
    const svgObj = document.getElementById('gameMap');
    provIDs.forEach(provID => {
        if(!gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID)){
            const pathReference = document.getElementById(provID);
            pathReference.classList.remove('enabledProvince');
            svgObj.removeChild(pathReference);
            svgObj.insertBefore(pathReference, svgObj.firstChild)
    }
    });
}

function AddTerritoryToNation(nationID, provID){        
    gameInfo.nationInfo[nationID].provinces.push(provID);
    if (gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner]){
        gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner].provinces = gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner].provinces.filter(function(ele){ 
            return ele != provID; 
        });
;
    }
    gameInfo.provinceInfo[provID].owner = nationID;
    UpdateMap(gameInfo.nationInfo[nationID].color,provID);
}

function UpdateMap(color, provID){
        const element = document.getElementById(provID);
        element.style.fill = color;
}
async function LoadGameConfiguration(){
    const resJSON = JSON.parse(await ResourceRequest(baseURL +  '/gameState'));
    for(let key in resJSON){
        gameInfo[key] = {...resJSON[key]}
    }
}

async function LoadSVG() {
        const resXML = new DOMParser().parseFromString(await ResourceRequest(baseURL + '/europe'), 'image/svg+xml');
        const svgObj = resXML.getElementsByTagName('svg')[0];
        svgObj.querySelectorAll('path').forEach(element => {
            const provID = element.getAttribute('id');
            element.removeAttribute('style');
            element.classList.add('province');
            element.addEventListener('click',function(){
                ProvinceSelect(provID);
            });
        });
        const map = document.getElementById('mapdiv');
        map.appendChild(svgObj);
    }


function ProvinceSelect(provID){
    if(!gameInfo.focused){
        if(gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID)){
            FocusProvince(provID);
            gameInfo.focused = true;
            gameInfo.lastFocused = provID;
        }
    }else{
        ResetFocus();
        if(gameInfo.provinceInfo[gameInfo.lastFocused].neighbors.includes(provID) && !gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID)){
            AddTerritoryToNation(gameInfo.playingAs, provID);
        }
        DisableProvinces(gameInfo.provinceInfo[gameInfo.lastFocused].neighbors);
        gameInfo.focused = false;
    }
}

function FocusProvince(provID){
    const allProvs = [...document.getElementsByTagName('path')];
    const whiteList = gameInfo.provinceInfo[provID].neighbors;
    allProvs.forEach(e => {
        if(!(whiteList.includes(e.getAttribute('id')) ||  e.getAttribute('id') === provID)){
            e.classList.add("disabledProvince");
        }
    });
    EnableProvinces(whiteList);
}

function ResetFocus(){
    const allProvs = [...document.getElementsByTagName('path')];
    allProvs.forEach(e => {
            e.classList.remove("disabledProvince");
    });
}