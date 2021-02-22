function ResourceRequest(url){
    return new Promise ((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.open('GET', url);
        req.send();
        req.onreadystatechange = function(){
            if(req.readyState === XMLHttpRequest.DONE){
                if(req.status == 200){
                    resolve(req.response);
                }else{
                    reject(req.response);
                }
            }
        }
    });
}

async function PromptPlayerAction(provID){
    document.getElementById('overlayArea').style.display = 'flex';
    let selfDefiningBtns = document.getElementsByClassName("selfDefiningBtn");
    console.log(selfDefiningBtns);
    return new Promise(resolve => {
        Array.from(selfDefiningBtns).forEach(btn => {
            let parentObj = btn.parentElement;
            let newBtn = btn.cloneNode(true);
            newBtn.addEventListener('click', function(){
                ResetPopup();
                resolve(btn.getAttribute('id'))
            });
            parentObj.replaceChild(newBtn,btn);
        })
    });
}
function ResetPopup(){
    document.getElementById('overlayArea').style.display = 'none';
    SwitchSubscreen(1);
}
var currentSubscreen = 1;
function SwitchSubscreen(numb){

    document.getElementById(`subscreen${currentSubscreen}`).style.display = 'none';
    currentSubscreen = numb;
    document.getElementById(`subscreen${currentSubscreen}`).style.display = 'block';
}
