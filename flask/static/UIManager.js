var currentSubmenu, currentSubscreen = 0;

async function RevealSubmenu(MenuID){
    console.log(MenuID);
    ChangeDisplayState(document.getElementById('backdrop'), 'flex');
    currentSubmenu = document.getElementById(MenuID);
    ChangeDisplayState(currentSubmenu,'flex');
    RevealSubscreen(0);
    return PromptPlayerAction();
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

async function PromptPlayerAction(){
    let selfDefiningBtns = currentSubmenu.getElementsByClassName("selfDefiningBtn");
    return new Promise(resolve => {
        Array.from(selfDefiningBtns).forEach(btn => {
            let parentObj = btn.parentElement;
            let newBtn = btn.cloneNode(true);
            newBtn.addEventListener('click', function(){
                DismissSubmenu();
                resolve(btn.getAttribute('id'))
            });
            parentObj.replaceChild(newBtn,btn);
        })
    });
}