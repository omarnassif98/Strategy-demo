function RevealOverlay(){
    document.getElementById('backdrop').style.display = 'flex'
}
//In game menus take the form of a simple popup with a populated with buttons that simply resolve to their values
async function RevealActionMenu(MenuID, vals){
    document.getElementById('actionPrompt').innerHTML = MenuID;
    RevealOverlay();
    return PromptPlayerAction(vals);
}

function EnablePregame(){
    document.getElementById('PreGame').style.display = 'flex'
    document.getElementById('actionMenu').style.display = 'none'
}

function EnableActions(){
    document.getElementById('actionMenu').style.display = 'block'
    document.getElementById('PreGame').style.display = 'none'
}


function DismissOverlay(){
    document.getElementById('backdrop').style.display = 'none';
    console.log('dismissed');
}

async function PromptPlayerAction(resolutionVals){
    wrapper = document.getElementById('actionMenu');
    while(wrapper.childElementCount > 1){
        wrapper.removeChild(wrapper.lastChild);
    }
    return new Promise(resolve => {
        resolutionVals.forEach(resVal => {
            let newBtn = document.createElement('button');
            newBtn.innerHTML = resVal;
            newBtn.addEventListener('click', function(){
                DismissOverlay();
                resolve(newBtn.innerHTML);
            });
            wrapper.appendChild(newBtn);
        });
    });
}



let chatMessages = {'all':[]}
chatFocused = 'all'

function SwitchChatFocus(newFocus){
    chatFocused = newFocus;
    let chatWrapper = document.getElementById('messages');
    while(chatWrapper.children.length > 0){
        chatWrapper.removeChild(chatWrapper.lastChild)
    }
    chatMessages[newFocus].forEach(chatMessage => {
        let msgObj = document.createElement('li');
        msgObj.innerHTML = chatMessage;
        chatWrapper.appendChild(msgObj);
    })
}
function PopulateChatOptions(){
    let select = document.getElementById('otherPlayers')
    for (nationID in gameInfo.nationInfo){
        chatMessages[nationID] = []
        if(nationID == gameInfo.playingAs){
            continue;
        }
        let option = document.createElement('option');
        option.innerHTML = gameInfo.nationInfo[nationID].properName;
        option.value = nationID;
        select.appendChild(option)
    }
}

function AppendToChat(chat, message, sender){
    console.log([chat, message, chat]);
    let newMsg = `<span style='color:${gameInfo.nationInfo[sender].color}'>${sender}:</span> ${message}`;
    chatMessages[chat].push(newMsg);
    if(chat == chatFocused){
        let msgObj = document.createElement('li');
        msgObj.innerHTML = newMsg;
        document.getElementById('messages').appendChild(msgObj);
    }
}
