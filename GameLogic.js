function UpdateLastClicked(obj){
    const territory = obj.childNodes[1];
    document.getElementById("LastClicked").innerHTML = "Clicked on a <span style='color:red;'>" + territory.getAttribute("name") + "</span>";
}