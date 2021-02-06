console.log('Starting');
const resourceRequest = new XMLHttpRequest();
resourceRequest.open('GET', window.origin + '/europe');
resourceRequest.send();
resourceRequest.onreadystatechange = function() {
    if(resourceRequest.readyState === XMLHttpRequest.DONE){
        const resXML = new DOMParser().parseFromString(resourceRequest.response, 'image/svg+xml');
        const svgObj = resXML.getElementsByTagName('svg')[0];
        svgObj.querySelectorAll('path').forEach(element => {
            console.log(element);
            const provID = element.getAttribute('id');
            element.removeAttribute('style');
        });
        const map = document.getElementById('mapdiv');
        map.appendChild(svgObj);
        
    }else{
        console.log(resourceRequest.statusText);
    }
}