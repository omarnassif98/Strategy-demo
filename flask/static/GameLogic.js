var gameInfo = {
    "provinceInfo":{},
    "nationInfo":{},
    "turnNumb":-1,
    "deadline": "01 September 1939 12:00 GMT",
    "gameState":0,
    "playingAs":""}
const baseURL = window.origin;
SetupGame();
async function SetupGame(){
    await LoadGameConfiguration();
    await LoadSVG();
}

for (countryTag in gameInfo.nationInfo){
    for(prov in gameInfo.nationInfo[countryTag].provinces){
        print(countryTag + ' - ' + prov);
    }
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
            console.log(`${provID} is a province`);
            element.removeAttribute('style');
            element.classList.add('province');
            if(gameInfo.provinceInfo[provID]){
                element.style.fill = gameInfo.nationInfo[gameInfo.provinceInfo[provID].owner].color;
            }
            element.addEventListener('click',function(){
                ProvinceSelect(provID);
            });
        });
        const map = document.getElementById('mapdiv');
        map.appendChild(svgObj);
    }


function ProvinceSelect(provID){
    console.log(gameInfo.provinceInfo[provID]);
}

function FocusProvince(){
    const allProvs = document.getElementsByClassName('mapDiv');
    for (e in allProvs){
        e.removeAttribute()
    }
}