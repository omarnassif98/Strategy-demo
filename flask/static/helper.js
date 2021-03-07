function ResourceRequest(url, method = 'GET', data = {}){
    let contentHeader = (Object.keys(data).length > 0) ? 'application/json':'text/plain';
    console.log(data);
    return new Promise ((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.open(method, url);
        req.setRequestHeader('Content-type',contentHeader)
        req.send(JSON.stringify(data));
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