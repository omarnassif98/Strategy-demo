var staggeredInputTimeout = null;
var configData;
let createButtonLock = [false, false]
document.addEventListener('authComplete', function(){TickButtonLock(1)})
window.onload = function(){
    LoadGames();
    EnsureConfigs();
}

async function LoadGames(){
    var res = await ResourceRequest(window.origin + '/gameList');
    if (res == 204){
        alert('Server connectivity issue');
        return;
    }
    console.log('heyyo, filling in browse page');
    res = JSON.parse(res);
    let games = res.content;
    console.log(games);
    let gameGallery = document.getElementById('gameGallery');
    games.forEach(session => {
        console.log(session);
        let sessionWrapper = document.createElement('div');
        sessionWrapper.className = 'gameInstance';

        let gameInfoContainer = document.createElement('div');
        gameInfoContainer.className = 'gameInfoContainer';

        let gameTitle = document.createElement('span');
        gameTitle.className = 'gameTitle';
        gameTitle.innerHTML = session["sessionName"];
        let host = document.createElement('span');
        host.className = 'host';
        host.innerHTML = session["host"];

        gameInfoContainer.appendChild(gameTitle);
        gameInfoContainer.appendChild(host);
        
        let vacancies = document.createElement('div');
        vacancies.className = 'vacancies';
        let joinButton = document.createElement('button');
        joinButton.addEventListener('click', function(){JoinGameScreen(session['sessionName'], session['remaining'])});
        joinButton.innerHTML = 'Join Game';

        sessionWrapper.appendChild(gameInfoContainer);
        sessionWrapper.appendChild(vacancies);
        sessionWrapper.appendChild(joinButton);
        
        gameGallery.appendChild(sessionWrapper)
        
    });
}

async function JoinGameScreen(sessionName, remaining){
    document.getElementById('pageOverlay').style.display = 'flex';
    document.getElementById('JoinGameScreen').style.display = 'block';
    let selection = document.getElementById('joinGameNationSelect');
    remaining.forEach(tag => {
        let nationOption = document.createElement('option');
        nationOption.innerHTML = tag;
        selection.appendChild(nationOption);
    });

    let choice = await new Promise((resolve) => {
        document.getElementById('joinGameScreenButton').addEventListener('click', function(){
            resolve(selection.options[selection.selectedIndex].text);
        });
    });
    console.log(choice);

    let jsonData = {
        'gameName':sessionName,
        'participantData':
        {
            'uid':firebase.auth().currentUser.uid,
            'data':
            {
                'nation':choice,
                'username':sessionStorage.getItem('userName')
            }
        }
    }
    let res = await ResourceRequest(window.origin + '/game-join', 'POST', jsonData);
    if(res == 201){
        window.location = window.origin + '/game/' + sessionName;
    }
}



async function EnsureConfigs(){
    if(localStorage.getItem('mapConfigs') == null){
        let jsonData = await ResourceRequest(window.origin + '/gameconfigs');
        localStorage.setItem('mapConfigs', jsonData);
    }
    configData = JSON.parse(localStorage.getItem('mapConfigs'));
    TickButtonLock(0);
}

function TickButtonLock(idx){
    console.log('ticked ' + idx);
    createButtonLock[idx] = true;
    for(let i = 0; i <createButtonLock.length; i++){
        if(createButtonLock[i] == false){
            return;
        }
    }
    console.log('Enabling');
    Array.from(document.getElementsByClassName('clickLock')).forEach(elem => elem.disabled = false)
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
    let submitButton = document.getElementById('formSubmit');
    submitButton.disabled = true;
    clearTimeout(staggeredInputTimeout);
    if(input.value == ""){
        console.log('Nulled');
        return;
    }
    staggeredInputTimeout = setTimeout(function(){NameCheck(input, submitButton)}, 400);
}

async function CreateGame(form){
    let data = new FormData(form);
    let jsonData = {
        'gameName':data.get('sessionName'),
        'gameSettings':{'mapType':data.get('mapType')},
        'participantData':
        {
            'uid':firebase.auth().currentUser.uid,
            'data':
            {
                'nation':data.get('nationSelect'),
                'username':sessionStorage.getItem('userName')
            }
        }
    }
    let res = await ResourceRequest(window.origin + '/game-create', 'POST', jsonData);
    if(res==201){
        window.location = window.origin + '/game/' + data.get('sessionName');
    }
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