document.addEventListener('provSelection', function(selectionEvent){ProvinceSelect(selectionEvent.detail.prov)})

async function ProvinceSelect(provID){
    console.log(provID);
    if(gameInfo.lockStep == false){
        if(!gameInfo.focused){
            if(gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.includes(provID)){
                let action = (await RevealActionMenu('Choose an action', ['Attack', 'Support Defense', 'Support Attack']))
                console.log(action);
                gameInfo.queuedMoves[provID] = {"moveType": action};
                switch(action){
                    case 'Support Attack':
                        let supporting = (await RevealActionMenu('Who to support?', [...Object.keys(gameInfo.nationInfo)]))
                        gameInfo.queuedMoves[provID].supporting = supporting;
                    case 'Attack':
                        FocusProvince(provID,false);
                        break;
                    case 'Support Defense':
                        FocusProvince(provID,gameInfo.provinceInfo[provID].neighbors.filter(prov => (gameInfo.provinceInfo[prov].troopPresence)));
                        break;
                    default:
                        delete gameInfo.queuedMoves[provID];
                        UpdateSendActionButtonStatus();
                        return;
                }
            }
        }else{
            if(Object.keys(instantiatedPlans).includes(gameInfo.lastFocused)){
                DeletePlan(gameInfo.lastFocused);
            }
            console.log('eyyo wtf ' + provID);
            console.log(enabledProvinces);
            if(enabledProvinces.includes(provID) && provID != gameInfo.lastFocused){
                gameInfo.queuedMoves[gameInfo.lastFocused].destProv = provID;   
                Drawline(gameInfo.lastFocused, provID);
            }else{
                delete gameInfo.queuedMoves[gameInfo.lastFocused];
            }
            UpdateSendActionButtonStatus();
            ResetFocus();
            DisableProvinces(gameInfo.provinceInfo[gameInfo.lastFocused].neighbors);
            EnableProvinces([...gameInfo.nationInfo[gameInfo.playingAs].provinces, ...gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed]);
        }
    }else{
        if(gameInfo.focused == false){
            if(enabledProvinces.includes(provID)){
                if(gameInfo.nationInfo[gameInfo.playingAs].defeats.includes(provID)){
                    let action = (await RevealActionMenu(provID + ' has been overrun', ['Retreat', 'Destroy']))
                    switch (action) {
                        case 'Retreat':
                            console.log(gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == false && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs));
                            FocusProvince(provID, gameInfo.provinceInfo[provID].neighbors.filter(prov => gameInfo.provinceInfo[prov].troopPresence == null && gameInfo.provinceInfo[prov].owner == gameInfo.playingAs));
                            return;
                            
                        case 'Destroy':
                            if(Object.keys(instantiatedPlans).includes(provID)){
                                DeletePlan(provID);
                            }
                            console.log('de_stroyed');
                            DestroyDefeat(provID);
                            
                            gameInfo.queuedMoves[provID] = {'lockMove':'cull'};

                            break;
                    }
                }else if (gameInfo.provinceInfo[provID].troopPresence == gameInfo.playingAs){
                    let action = (await RevealActionMenu('Destroy troop in ' + provID + '?', ['Confirm', 'Cancel']))
                    if(action=='Confirm'){
                        DestroyTroop(provID);
                        gameInfo.queuedMoves[provID] = {'lockMove':'destroy'};
                    }
                }else if(gameInfo.nationInfo[gameInfo.playingAs].cores.includes(provID)){
                    let action = (await RevealActionMenu('Create Troop in ' + provID + '?', ['Confirm', 'Cancel']))
                    if(action=='Confirm'){
                        CreateTroop(gameInfo.playingAs, provID);
                        gameInfo.queuedMoves[provID] = {'lockMove':'create'};
                        gameInfo.nationInfo[gameInfo.playingAs].troopsDeployed.push(provID);
                        DisableProvinces(enabledProvinces);
                    }
                }
            }
        }else{
            
            if(Object.keys(instantiatedPlans).includes(gameInfo.lastFocused)){
                DeletePlan(gameInfo.lastFocused);
            }else if(!instantiatedDefeats[provID]){
                DrawDefeat(gameInfo.playingAs, gameInfo.lastFocused);
            }
            if(enabledProvinces.includes(provID) && provID != gameInfo.lastFocused){
                    gameInfo.queuedMoves[gameInfo.lastFocused] = {'lockMove':'retreat', 'destProv':provID};
                    Drawline(gameInfo.lastFocused, provID);
            }
            DisableProvinces(enabledProvinces);
            ResetFocus();
            }
            
            SetupLockConditions();
            UpdateSendActionButtonStatus();
        }
}