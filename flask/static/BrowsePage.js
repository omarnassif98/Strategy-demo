var staggeredInputTimeout = null;

async function NameCheck(input){
    input.parentNode.lastElementChild.innerHTML = 'Checking'
    let res = await ResourceRequest(window.origin + '/game-check/' + input.value);
    console.log(res);
    if(res == 201){
        input.parentNode.lastElementChild.innerHTML = 'Name available'
        input.parentNode.parentNode.parentNode.lastElementChild.disabled = false;
    }else{
        input.parentNode.lastElementChild.innerHTML = 'Name taken'
    }
}

function StaggeredNameCheck(input){
    input.parentNode.lastElementChild.innerHTML = ''
    input.parentNode.parentNode.parentNode.lastElementChild.disabled = true
    clearTimeout(staggeredInputTimeout);
    if(input.value == ""){
        console.log('Nulled');
        return;
    }
    staggeredInputTimeout = setTimeout(function(){NameCheck(input)}, 400);
}

async function CreateGame(form){
    console.log(form);
    let data = new FormData(form);
    console.log(data);
    //await ResourceRequest(window.origin + '/game-create', method='POST', data={'name':firebase.auth().currentUser.uid});
    //console.log('Game created?');
}