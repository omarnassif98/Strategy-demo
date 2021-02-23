var currentSubmenu, currentSubscreen = 0;

async function RevealSubmenu(MenuID){
    document.getElementById('overlayArea').style.display = 'flex';
    currentSubmenu = document.getElementById(MenuID);
    currentSubmenu.style.display = 'flex';
    RevealSubscreen(0);
    return PromptPlayerAction();
}

function RevealSubscreen(screenNumb){
    currentSubmenu.children[currentSubscreen].style.display = 'none';
    currentSubmenu.children[screenNumb].style.display = 'block';
    currentSubscreen= screenNumb;
}

function DismissSubmenu(){
    document.getElementById('overlayArea').style.display = 'none';
    currentSubmenu.children[currentSubscreen].style.display = 'none';
    currentSubmenu.style.display = 'none';
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