function ResourceRequest(url, method = 'GET', data = {}){
    return new Promise ((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.open('GET', url);
        req.send(data);
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