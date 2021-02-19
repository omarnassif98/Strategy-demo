var gameInfo = {
    "provinceInfo":{},
    "nationInfo":{},
    "turnNumb":-1,
    "deadline": "01 September 1939 12:00 GMT",
    "focused":false,
    "lastFocused":"",
    "turnComplete":false,
    "playingAs":"ITA"
}
const baseURL = window.origin;
SetupGame();

async function SetupGame(){
    await LoadGameConfiguration();
    await LoadSVG();
    
    for(nationID in gameInfo.nationInfo){
        gameInfo.nationInfo[nationID].provinces.forEach(provID => {
            const element = document.getElementById(provID);
            element.style.fill = gameInfo.nationInfo[nationID].color;
        });
    }
    
    EnableProvinces(gameInfo.nationInfo[gameInfo.playingAs].provinces);
}

function EnableProvinces(provIDs){
    const svgObj = document.getElementById('svg51');
    provIDs.forEach(provID => {
        const pathReference = document.getElementById(provID);
        pathReference.classList.add('enabledProvince');
        svgObj.removeChild(pathReference);
        svgObj.appendChild(pathReference)
    });
}
function DisableProvinces(provIDs){
    const svgObj = document.getElementById('svg51');
    provIDs.forEach(provID => {
        if(!gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID)){
            const pathReference = document.getElementById(provID);
            pathReference.classList.remove('enabledProvince');
            svgObj.removeChild(pathReference);
            svgObj.insertBefore(pathReference, svgObj.firstChild)
    }
    });
}

function AddTerritoryToNation(nationID, provIDs){
    console.log(`Actually adding territory to ${nationID}`);
    provIDs.forEach(provID => {
        console.log(`Adding ${provID} to ${nationID}`);
        const element = document.getElementById(provID);
        element.style.fill = gameInfo.nationInfo[nationID].color;
        gameInfo.nationInfo[nationID].provinces.push(provID);
        //gameInfo.provinceInfo[provID].owner = nationID;
    });
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
    console.log(provID);
    if(gameInfo.nationInfo[gameInfo.playingAs].provinces.includes(provID) && !gameInfo.focused){
        FocusProvince(provID);
        gameInfo.focused = true;
        gameInfo.lastFocused = provID;
    }else{
        ResetFocus();
        if(gameInfo.provinceInfo[gameInfo.lastFocused].neighbors.includes(provID)){
            
            const copy = gameInfo.playingAs.valueOf();
            console.log(`should be adding territory to ${copy}`);
            AddTerritoryToNation(copy, [provID]);
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