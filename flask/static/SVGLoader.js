console.log('Starting');
var provinceInfo = {}
LoadSVG();
console.log('loaded svg');
LoadProvinceMetadata();
console.log('loaded metadata');
function LoadSVG() {
        const resourceRequest = new XMLHttpRequest();
        resourceRequest.open('GET', window.origin + '/europe');
        resourceRequest.send();
        resourceRequest.onreadystatechange = function() {
            if(resourceRequest.readyState === XMLHttpRequest.DONE){
                const resXML = new DOMParser().parseFromString(resourceRequest.response, 'image/svg+xml');
                const svgObj = resXML.getElementsByTagName('svg')[0];
                svgObj.querySelectorAll('path').forEach(element => {
                    const provID = element.getAttribute('id');
                    element.removeAttribute('style');
                    element.addEventListener('click',function(){
                        ProvinceSelect(provID)
                    });
                });
                const map = document.getElementById('mapdiv');
                map.appendChild(svgObj);
            }
        }
    }

function LoadProvinceMetadata() {
        const resourceRequest = new XMLHttpRequest();
        resourceRequest.open('GET', window.origin + '/provinceData');
        resourceRequest.send();
        resourceRequest.onreadystatechange = function() {
            if(resourceRequest.readyState === XMLHttpRequest.DONE){
                const resJSON = JSON.parse(resourceRequest.response);
                for (let key in resJSON){
                    console.log([key, resJSON[key]]);
                    provinceInfo[key] = resJSON[key]
                }
            }
        }
    }

function ProvinceSelect(provID){
    console.log([provID, provinceInfo[provID]]);
}