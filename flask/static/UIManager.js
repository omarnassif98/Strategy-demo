var currentSubmenu, currentSubscreen = 0;

async function RevealSubmenu(MenuID, vals){
    console.log(MenuID);
    ChangeDisplayState(document.getElementById('backdrop'), 'flex');
    currentSubmenu = document.getElementById(MenuID);
    ChangeDisplayState(currentSubmenu,'flex');
    RevealSubscreen(0);
    return PromptPlayerAction(vals);
}

function RevealSubscreen(screenNumb){
    ChangeDisplayState(currentSubmenu.children[currentSubscreen], 'none');
    ChangeDisplayState(currentSubmenu.children[screenNumb], 'block');
    currentSubscreen= screenNumb;
}

function ChangeDisplayState(element, state){
    element.style.display = state;
}

function DismissSubmenu(){
    ChangeDisplayState(document.getElementById('backdrop'), 'none');
    ChangeDisplayState(currentSubmenu.children[currentSubscreen], 'none');
    ChangeDisplayState(currentSubmenu, 'none');
    currentSubmenu = null;
    currentSubscreen = 0;
    console.log('dismissed');
}

async function PromptPlayerAction(resolutionVals){
    wrapper = currentSubmenu.children[currentSubscreen];
    while(wrapper.childElementCount > 1){
        wrapper.removeChild(wrapper.lastChild);
    }
    return new Promise(resolve => {
        resolutionVals.forEach(resVal => {
            let newBtn = document.createElement('button');
            newBtn.innerHTML = resVal;
            newBtn.addEventListener('click', function(){
                DismissSubmenu();
                resolve(newBtn.innerHTML);
            });
            wrapper.appendChild(newBtn);
        });
    });
}