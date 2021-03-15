var staggeredInputTimeout = null;
var configData;
EnsureConfigs();

async function EnsureConfigs(){
    let jsonData = await ResourceRequest(window.origin + '/gameconfigs');
        localStorage.setItem('mapConfigs', jsonData);
    if(localStorage.getItem('mapConfigs') == null || true){
        
        
    }
    configData = JSON.parse(localStorage.getItem('mapConfigs'));
    document.getElementById('createButton').disabled = false;
}

async function NameCheck(input, submitButton){
    input.style.borderColor = 'khaki';
    input.parentNode.lastElementChild.innerHTML = 'Checking';
    let res = await ResourceRequest(window.origin + '/game-check/' + input.value);
    console.log(res);
    if(res == 201){
        input.parentNode.lastElementChild.innerHTML = 'Name available'
        input.style.borderColor = 'yellowgreen';
        submitButton.disabled = false;
    }else{
        input.parentNode.lastElementChild.innerHTML = 'Name taken';
        input.style.borderColor = 'orange'
    }
}

function StaggeredNameCheck(input){
    input.parentNode.lastElementChild.innerHTML = '';
    input.style.removeProperty('border-color');
    let submitButton = input.parentNode.parentNode.parentNode.lastElementChild;
    submitButton.disabled = true;
    clearTimeout(staggeredInputTimeout);
    if(input.value == ""){
        console.log('Nulled');
        return;
    }
    staggeredInputTimeout = setTimeout(function(){NameCheck(input, submitButton)}, 400);
}

async function CreateGame(field){
    let data = new FormData(form);
    let jsonData = {
        'gameName':data.get('sessionName'),
        'gameSettings':{},
        'participantData':{'data':{}}}
    field.getElementsByTagName('div').forEach()
    console.log(jsonData);
    //await ResourceRequest(window.origin + '/game-create', method='POST', data={'name':firebase.auth().currentUser.uid});
    //console.log('Game created?');
}

async function UpdateNationOptions(selector){
    console.log(selector.value);
    let nationSelector = document.getElementById('nationSelector');
    while(nationSelector.children.length > 0){
        nationSelector.removeChild(nationSelector.lastChild);
    }
    let subConfig = configData[selector.value];
    for (let i = 0; i < subConfig.roster.length; i++){
        let nationChoice = document.createElement('option');
        nationChoice.setAttribute('value', subConfig.roster[i]);
        nationChoice.innerHTML = subConfig.fullNames[i];
        nationSelector.appendChild(nationChoice);
    }
    nationSelector.disabled = false
}