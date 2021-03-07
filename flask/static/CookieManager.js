const cookieVals = {};
ScrapeCookie();
function ScrapeCookie(){
    for(let key in cookieVals){
        delete cookieVals[key]
    }
    let valArray = document.cookie.split(';');
    valArray.forEach(keyVal => {
        let [key, val] = keyVal.split('=');
        cookieVals[key] = val;
    });
}

function WriteToCookie(){
    let keyValuePairs = '';
    for(let key in cookieVals){
        keyValuePairs += key + '=' + cookieVals[key] + ';';
    }
    console.log(keyValuePairs + "domain=" + window.origin + ";sameSite=Strict;path=/;");
    document.cookie = keyValuePairs + "domain=" + window.origin + ";sameSite=Strict;path=/;";
    
}