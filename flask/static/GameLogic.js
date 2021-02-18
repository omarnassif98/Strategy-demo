var gameInfo = {
    "provinceInfo":{},
    "nationInfo":{},
    "turnNumb":-1,
    "deadline": "01 September 1939 12:00 GMT",
    "gameState":0,
    "playingAs":""}
const baseURL = window.origin;

LoadGameConfiguration();
LoadSVG();
for (countryTag in gameInfo.nationInfo){
    for(prov in gameInfo.nationInfo[countryTag].provinces){
        print(countryTag + ' - ' + prov);
    }
}



function LoadGameConfiguration(){
    const resourceRequest = new XMLHttpRequest();
    resourceRequest.open('GET', baseURL +  '/gameState');
    resourceRequest.send();
    resourceRequest.onreadystatechange = function() {
        if(resourceRequest.readyState === XMLHttpRequest.DONE){
            const resJSON = JSON.parse(resourceRequest.response);
            for(let key in resJSON){
                gameInfo[key] = {...resJSON[key]}
            }
        }
    }
}

function LoadSVG() {
    const resourceRequest = new XMLHttpRequest();
        resourceRequest.open('GET', baseURL + '/europe');
        resourceRequest.send();
        resourceRequest.onreadystatechange = function() {
        if(resourceRequest.readyState === XMLHttpRequest.DONE){
            const resXML = new DOMParser().parseFromString(resourceRequest.response, 'image/svg+xml');
            const svgObj = resXML.getElementsByTagName('svg')[0];
            svgObj.querySelectorAll('path').forEach(element => {
                const provID = element.getAttribute('id');
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
    }
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