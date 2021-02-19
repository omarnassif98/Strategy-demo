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