let allProvIDs = [];
var enabledProvinces = [];
var tankGraphic = null;
var starGraphic = null;
let instantiatedTanks = {}
let instantiatedStars = {}
let instantiatedPlans = {}
let planDestinations = []
let instantiatedDefeats = {}

async function LoadMap(mapType, provinceInfo) {
    console.log('Loading map ' + mapType);
    let req = await ResourceRequest(baseURL + '/mapResources/' + mapType);
    const resXML = new DOMParser().parseFromString(req, 'image/svg+xml');
    const wrapperGroup = document.createElementNS("http://www.w3.org/2000/svg","g");
    const svgObj = resXML.getElementById('gameMap');
    
    svgObj.querySelectorAll('#gameMap > path').forEach(element => {
        const provID = element.getAttribute('id');
        allProvIDs.push(provID);
        element.removeAttribute('style');
        element.classList.add('province');
        if(element.getAttribute("id").split('_').length < 2){
            element.classList.add('land');
        }else{
            element.classList.add('ocean');
            provinceInfo[provID].owner = null;
        }

        element.addEventListener('click',function(){
            console.log('clicked 1');
            var provSelectionEvent = new CustomEvent('provSelection', {'detail':{'prov':provID}});
            document.dispatchEvent(provSelectionEvent);
        });
        
        element.addEventListener('contextmenu',function(event){
            ProvinceSelect(provID, false);
            event.preventDefault();
        });
    });
    document.getElementById('gameArea').style.display = 'block';
    svgObj.appendChild(wrapperGroup);
    const overlay = document.getElementById('gameArea').replaceChild(svgObj, document.getElementById('gameArea').firstChild);
    document.getElementById('gameArea').appendChild(overlay);
}

function SetupMapLayout(keyProvinceMetadata ,provinceMetadata){
    keyProvinceMetadata.forEach(provID => {    
        let pathReference = document.getElementById(provID);
        let [centerX, centerY] = [Number(provinceMetadata[provID].tokenLocation.x), Number(provinceMetadata[provID].tokenLocation.y)];
        let starInstance = starGraphic.cloneNode(deep=true);
        pathReference.parentElement.appendChild(starInstance);
        //console.log(starInstance.getBoundingClientRect());
        let [height, width] = [starInstance.getBoundingClientRect().height, starInstance.getBoundingClientRect().width];
        starInstance.setAttribute('x',centerX - width/2);
        starInstance.setAttribute('y',centerY - height/2); 
    });
}

function ApplyConfiguration(nationMetadata, provinceMetadata){
    console.log('Configuration is being applied');
    DisableProvinces(enabledProvinces);
    //Remove tanks from where they shouldn't be (previous positions after moves)
    for(provID in instantiatedTanks){
        DeleteTroopToken(provID);
    }
    for(provID in instantiatedDefeats){
        console.log('removing');
        DeleteDefeat(provID);
    }
    for(nationID in nationMetadata){
        nationMetadata[nationID].provinces.forEach(provID => ColorProvince(nationMetadata[nationID].color, provID));
        nationMetadata[nationID].defeats.forEach(provID => DrawDefeat(nationID, provID, provinceMetadata[provID])); // pass in entire province info
        nationMetadata[nationID].troopsDeployed.forEach(provID => DrawTroopToken(nationMetadata[nationID].color,provID, provinceMetadata[provID]));  
    }
    if(gameInfo.lockStep){
        SetupLockConditions();
    }else if(gameInfo.playingAs){
        EnableProvinces([...gameInfo.nationInfo[gameInfo.playingAs].provinces, ...gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed]);
    }
}
async function LoadTankGraphic(){
    const resXML = new DOMParser().parseFromString(await ResourceRequest(baseURL + '/tank'), 'image/svg+xml');
    const svgObj = resXML.getElementsByClassName('tank')[0];
    tankGraphic = svgObj;
    tankGraphic.style.pointerEvents = 'none';
}
async function LoadStarGraphic(){
    const resXML = new DOMParser().parseFromString(await ResourceRequest(baseURL + '/star'), 'image/svg+xml');
    const svgObj = resXML.getElementById('star');
    starGraphic = svgObj;
    starGraphic.style.pointerEvents = "none";
}

function BringGraphicsToFront(){
    const svgObj = document.getElementById('gameMap');
    for(provID in instantiatedTanks){
        svgObj.removeChild(instantiatedTanks[provID]);
        svgObj.append(instantiatedTanks[provID])
    }
}
function DrawDefeat(nationID, provID, provInfo){
    console.log(nationID + " | " + provID);
    let pathReference = document.getElementById(provID);
    let [centerX, centerY] = [Number(provInfo.tokenLocation.x), Number(provInfo.tokenLocation.y)];
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

function DrawTroopToken(color, provID, provInfo){
    let pathReference = document.getElementById(provID);
    let [centerX, centerY] = [Number(provInfo.tokenLocation.x), Number(provInfo.tokenLocation.y)];
    var tankInstance = tankGraphic.cloneNode(deep=true);
    let instantiatedGraphic = pathReference.parentElement.appendChild(tankInstance);
    let [height, width] = [instantiatedGraphic.getBoundingClientRect().height, instantiatedGraphic.getBoundingClientRect().width];
    instantiatedGraphic.setAttribute('x',centerX - width/2)
    instantiatedGraphic.setAttribute('y',centerY - height/2)
    instantiatedTanks[provID] = instantiatedGraphic;
    instantiatedGraphic.style.fill = color;
}

function Drawline(fromProv, toProv){
    var newLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    newLine.setAttribute('id','line2');
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
    console.log('Plan created');
}



function DisableProvinces(provIDs){
    enabledProvinces = enabledProvinces.filter(provID => (provIDs.includes(provID) == false))
    provIDs.forEach(provID => {
        console.log('disabling ' + provID);
            const pathReference = document.getElementById(provID);
            pathReference.classList.remove('enabledProvince');
    });
}

function DeletePlan(provID){
    instantiatedPlans[provID].ref.remove();
    planDestinations = planDestinations.filter(prov => instantiatedPlans[provID].destination != prov);
    delete instantiatedPlans[provID];
    delete gameInfo.queuedMoves[provID];
}

function DeleteTroopToken(provID){
    instantiatedTanks[provID].remove();
    delete instantiatedTanks[provID];
}

function DeleteDefeat(provID){
    DestroyDefeat(provID);
    delete instantiatedDefeats[provID];
}

function DestroyDefeat(provID){
    if(instantiatedDefeats[provID]){
        instantiatedDefeats[provID].remove();
    }
    instantiatedDefeats[provID] = null;
}

function ColorProvince(color, provID){
    const element = document.getElementById(provID);
    element.style.fill = color;
}

function EnableProvinces(provIDs, append = false){
    console.log('should be enabling');
    console.log(provIDs);
    enabledProvinces = append ? [...enabledProvinces, ...provIDs]:[...provIDs];
    provIDs.forEach(provID => {
        const pathReference = document.getElementById(provID);
        pathReference.classList.add('enabledProvince');    
    });
}

function ResetFocus(){
    let allProvs = [...document.getElementsByClassName('province')];
    gameInfo.focused = false;
    allProvs.forEach(e => {
            e.classList.remove("disabledProvince");
    });
}