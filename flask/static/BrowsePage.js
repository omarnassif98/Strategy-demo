var staggeredInputTimeout = null;
var configData;
let createButtonLock = [false, false]
let listingNodes = {'public':{},'user':{}}
document.addEventListener('authComplete', function(){
       
    var loadListings = async function(){
        await LoadGames('userGames', firebase.auth().currentUser.uid + '/get-games', true);
        await LoadGames('joinableGames', 'gameList');
        TickButtonLock(1);
    }
    loadListings();
});

document.addEventListener('noAuth', function(){
    var loadListings = async function(){
        await LoadGames('joinableGames', 'gameList');
    }
    loadListings();
});

window.onload = function(){
    document.getElementById('createSession').disabled = true;
    EnsureConfigs();
}

async function LoadGames(gameGalleryID, endpoint, buttonIsLink = false){
    let res = await ResourceRequest(window.origin + '/' + endpoint);
    return new Promise(resolve =>{
        if (res == 204){
            resolve();
        }
        console.log('Initial');
        games = JSON.parse(res);
        console.log(games);
        console.log(gameGalleryID);
        let gameGallery = document.getElementById(gameGalleryID);
        if(Object.keys(games).length > 0){
            gameGallery.parentNode.style.display = 'block';
        }
        for(gameName in games){
            if(gameName in listingNodes.public && !buttonIsLink){
                continue;
            }
            
            session = games[gameName]
            console.log(session);
            let sessionWrapper = document.createElement('div');
            sessionWrapper.className = 'gameInstance';

            let gameInfoContainer = document.createElement('div');
            gameInfoContainer.className = 'gameInfoContainer';

            let gameTitle = document.createElement('span');
            gameTitle.className = 'gameTitle';
            gameTitle.innerHTML = gameName;
            let host = document.createElement('span');
            host.className = 'host';
            host.innerHTML = session["host"];

            gameInfoContainer.appendChild(gameTitle);
            gameInfoContainer.appendChild(host);
            
            
            let joinButton = document.createElement('button');
            
            joinButton.innerHTML = 'Join Game';
            

            sessionWrapper.appendChild(gameInfoContainer);
            if(!buttonIsLink){
                if (!(gameName in listingNodes.user)){
                    listingNodes.public[gameName] = sessionWrapper;
                    joinButton.addEventListener('click', function(){JoinGameScreen(gameName, session['remaining'])});
                    joinButton.className = 'clickLock';
                    joinButton.disabled = true;
                    let vacancies = document.createElement('div');
                    vacancies.className = 'vacancies';
                    sessionWrapper.appendChild(vacancies);
                }else{
                    continue;
                }

            }else{
                joinButton.addEventListener('click', function(){window.location = window.origin + '/game/' + gameName});
                listingNodes.user[gameName] = true;
                if(gameName in listingNodes.public){
                    listingNodes.public[gameName].parentElement.removeChild(listingNodes.public[gameName]);
                    delete listingNodes.public[gameName];
                }
            }
            sessionWrapper.appendChild(joinButton);
            gameGallery.appendChild(sessionWrapper);
        }
        if(Object.keys(listingNodes.public).length == 0){
            document.getElementById('joinableGames').parentElement.style.display = 'none';
        }
        resolve();
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
    console.log(sessionName);
    let joinData = {
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
    let res = await ResourceRequest(window.origin + '/game-join', 'POST', joinData);
    if(res == 201){
        window.location = window.origin + '/game/' + sessionName;
    }
}



async function EnsureConfigs(){
    let jsonData = await ResourceRequest(window.origin + '/gameconfigs');
    configData = JSON.parse(jsonData);
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
    console.log('Got response ' + res);
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
    nationSelector.disabled = false;
}