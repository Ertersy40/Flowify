
// Constants
const redirect_uri = "http://127.0.0.1:5500/";
const AUTHORIZE = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const PLAYLISTS = "https://api.spotify.com/v1/me/playlists";
const DEVICES = "https://api.spotify.com/v1/me/player/devices";
const PLAY = "https://api.spotify.com/v1/me/player/play";
const PAUSE = "https://api.spotify.com/v1/me/player/pause";
const NEXT = "https://api.spotify.com/v1/me/player/next";
const PREVIOUS = "https://api.spotify.com/v1/me/player/previous";
const PLAYER = "https://api.spotify.com/v1/me/player";
const TRACKS = "https://api.spotify.com/v1/playlists/{{PlaylistId}}/tracks";
const CURRENTLYPLAYING = "https://api.spotify.com/v1/me/player/currently-playing";
const SHUFFLE = "https://api.spotify.com/v1/me/player/shuffle";
const FEATURES = "https://api.spotify.com/v1/audio-features?ids=";


var client_id = process.env.client_id;
var client_secret = process.env.client_secret; // In a real app you should not expose your client_secret to the user

// State Variables
let accessToken = null;
let refreshToken = null;
let currentPlaylist = "";
let radioButtons = [];
let graph = null;
let curTrait = "energy";
let first = true;
let curIDs = null;
let curNames = null;
let traits = ["energy", "danceability", "acousticness", "speechiness", "liveness", "instrumentalness"];

// Utility Functions
const range = (start, stop, step) => Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step));


var trackResponse = null
var curTarget = null;
var pldict = {"cur": 0, "curIDs": []};
var matched = null;
var chartNotSet = true;
var outCopy = {"items": []}
var energyList = {};
var newPL = false;
var newPL2 = false;

// Event Handlers and Main Functions
function onPageLoad(){
    if ( window.location.search.length > 0 ){
        handleRedirect();
    }
    else{
        access_token = localStorage.getItem("access_token");
        if ( access_token == null ){
            // we don't have an access token so present token section
            document.getElementById("tokenSection").style.display = 'block';  
        }
        else {
            // we have an access token so present device section
            document.getElementById("deviceSection").style.display = 'block';  
            refreshPlaylists();
            
        }
    }
    
}

function handleRedirect(){
    let code = getCode();
    fetchAccessToken( code );
    window.history.pushState("", "", redirect_uri); // remove param from url
}

async function setFlowWave(){
    var a = 0.314159264
    var b = 1
    var c = 20
    var d = 20
    var e = 0
    var f = 0
    var g = 0
    var xVals = [...Array(40).keys()]
    graph.options.scales.yAxes[0].ticks.min = 0
    graph.options.scales.yAxes[0].ticks.max = 40
    
    while (getCheckBoxes().every(element => element === false)){
        if (g < 39) {
            g += 1
        }
        else{
            g = 0
        }
        let target = xVals.map(function(item, index) { return d*Math.sin((item + g) * a) - f*(((item + g) * (item + g))/b) + e*(item + g) + c;});
        graph.data.labels = xVals
        graph.data.datasets[0].data = target
        graph.data.datasets[1].data = []
        graph.update()
        await new Promise(r => setTimeout(r, 100));
    }
}

function getCode(){
    let code = null;
    const queryString = window.location.search;
    if ( queryString.length > 0 ){
        const urlParams = new URLSearchParams(queryString);
        code = urlParams.get('code')
    }
    return code;
}

function requestAuthorization(){
    client_id = "2fe3cb0427aa436fa7e27b84f81ae942";
    client_secret = "81279f3abd924e5f9edbedee731e768e";
    localStorage.setItem("client_id", client_id);
    localStorage.setItem("client_secret", client_secret); // In a real app you should not expose your client_secret to the user

    let url = AUTHORIZE;
    url += "?client_id=" + client_id;
    url += "&response_type=code";
    url += "&redirect_uri=" + encodeURI(redirect_uri);
    url += "&show_dialog=true";
    url += "&scope=user-read-private playlist-modify-public playlist-modify-private user-read-email user-library-read playlist-read-private";
    window.location.href = url; // Show Spotify's authorization screen
}

function fetchAccessToken( code ){
    let body = "grant_type=authorization_code";
    body += "&code=" + code; 
    body += "&redirect_uri=" + encodeURI(redirect_uri);
    body += "&client_id=" + client_id;
    body += "&client_secret=" + client_secret;
    callAuthorizationApi(body);
}

function refreshAccessToken(){
    refresh_token = localStorage.getItem("refresh_token");
    let body = "grant_type=refresh_token";
    body += "&refresh_token=" + refresh_token;
    body += "&client_id=" + client_id;
    callAuthorizationApi(body);
}

function callAuthorizationApi(body){
    let xhr = new XMLHttpRequest();
    xhr.open("POST", TOKEN, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(client_id + ":" + client_secret));
    xhr.send(body);
    xhr.onload = handleAuthorizationResponse;
}

function handleAuthorizationResponse(){
    if ( this.status == 200 ){
        var data = JSON.parse(this.responseText);

        var data = JSON.parse(this.responseText);
        if ( data.access_token != undefined ){
            access_token = data.access_token;
            localStorage.setItem("access_token", access_token);
        }
        if ( data.refresh_token  != undefined ){
            refresh_token = data.refresh_token;
            localStorage.setItem("refresh_token", refresh_token);
        }
        onPageLoad();
    }
    else {
        console.log(this.responseText);
        alert(this.responseText);
    }
}

function callApi(method, url, body, callback){
    let xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    // xhr.setRequestHeader("Accept", "application/json")
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
    xhr.send(body);
    xhr.onload = callback;
    
}

function getCheckBoxes(){
    
    let states = [];
    for (let i = 0; i < traits.length; i++){
        states.push(document.getElementById(traits[i]).checked)
    }
    return states
}

function getFeatures(ids, names, idswOrder, pldict) {

    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            
            data = JSON.parse(this.responseText).audio_features;
            
            let energies = [];
            var min = 100000
            var max = 0
            
            var checkedboxes = getCheckBoxes()
            if (checkedboxes.every(element => element === false)){
                setFlowWave()
            }
            else{
                for (let i = 0; i < data.length; i++){
                    try{
                        var energyVal = 0
                        var cur = data[i.toString()];
                        var count = 0
                        for (let j = 0; j < traits.length; j++){
                            if (checkedboxes[j]){
                                energyVal += cur[traits[j]]
                                count += 1
                            }
                        }
                        energyVal = Math.round((energyVal / count) * 1000) / 10;
                        if (energyVal > max){
                            max = energyVal
                        }
                        if (energyVal < min){
                            min = energyVal
                        }
                        var energySpan = document.getElementById(idswOrder[i]);
                        energies.push(energyVal);
                        const trackEnergy = document.createTextNode(energyVal);
                        energySpan.appendChild(trackEnergy);
                    }
                    catch (e){
                        const index = names.indexOf(i);
                        if (index > -1) {
                        names.splice(index, 1);
                        }
                    }
                }
                if (newPL2){
                    setChart(energies, names, min, max, false);
                    newPL2 = false
                }
                else{
                    setChart(energies, names, min, max, true)
                }
            }            
        }
      };
    const url = FEATURES + ids.toString()
    xhr.open("GET", url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
    xhr.send();
}


function refreshPlaylists(){
    callApi( "GET", PLAYLISTS, null, handlePlaylistsResponse );
}

function handlePlaylistsResponse(){
    if ( this.status == 200 ){
        var data = JSON.parse(this.responseText);
        removeAllItems("playlists");
        data.items.forEach(item => addPlaylist(item));
        document.getElementById('playlists').value=currentPlaylist;
    }
    else if ( this.status == 401 ){
        refreshAccessToken()
    }
    else {
        console.log(this.responseText);
        alert(this.responseText);
    }
}

function addPlaylist(item){
    let node = document.createElement("option");
    node.value = item.id;
    node.innerHTML = item.name + " (" + item.tracks.total + ")";
    document.getElementById("playlists").appendChild(node); 
}

function removeAllItems( elementId ){
    let node = document.getElementById(elementId);
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function handleApiResponse(){
    if ( this.status == 200){
        console.log(this.responseText);
        setTimeout(currentlyPlaying, 2000);
    }
    else if ( this.status == 204 ){
        setTimeout(currentlyPlaying, 2000);
    }
    else if ( this.status == 401 ){
        refreshAccessToken()
    }
    else {
        console.log(this.responseText);
        alert(this.responseText);
    }    
}

function deviceId(){
    return document.getElementById("devices").value;
}
var curPlaylist_ID = null

function HandlePlaylistChange(){

    document.getElementById("flex-container").style.display = "flex"
    newPL = true
    // console.log("NewPL is true")
    newPL2 = true
    
    
    curPlaylist_ID = document.getElementById("playlists").value;    
    url = TRACKS.replace("{{PlaylistId}}", curPlaylist_ID);
    
    
    callApi("GET", url, null, getPages);
    
}

function getPages(){
    if (this.status == 200){
        let data = JSON.parse(this.responseText)
        if (!data.previous){
            handleTracksResponse1(data, true, false)
        }
        else{
            handleTracksResponse1(data, true, true)
        }
        if (data.next){
            callApi("GET", data.next, null, getPages)
        }
    }
    else if (this.status == 401 ){
        refreshAccessToken()
    }
    else {
        console.log(this.responseText);
        alert(this.responseText);
    }
}



async function handleTracksResponse1(trackResponse, check, append){
    document.getElementById("flex-container").style.display = "none";
    document.getElementById("tracks").style.display = "block";
    document.getElementById("chosenGraph").style.display = 'block';
    // await new Promise(r => setTimeout(r, 1000));
    // console.log(Object.keys(pldict).length)

    // handleTracksResponse1(finalOut, "tracks", "outputTracks", false)
    
    // console.log(divName)
    // console.log(idName)

    var tblBody = null;
    var ids = [];
    
    if (!append){
        pldict = {"cur": 0, "curIDs": []};
        document.getElementById("TableBody").remove()
        tblBody = document.createElement("tbody");
        tblBody.setAttribute("id", "TableBody");
    }
    else{
        
        tblBody = document.getElementById("TableBody")
        if (!tblBody){
            tblBody = document.createElement("tbody");
            tblBody.setAttribute("id", "TableBody");
            check2 = true
        }
    }
    var cur = pldict.cur
    var names = [];
    var data = trackResponse
    var idswOrder = [];
    
    for (let i = 0; i  < data.items.length; i++){
        try{
            let item = data.items[i];

            
            var trackDict = {};
            trackDict["url"] = item.track.album.images[0].url;
            const row = document.createElement("tr");
            

            const imgCell = document.createElement("td");
            const imgurl = document.createElement("img");
            imgurl.setAttribute("src", item.track.album.images[0].url);
            imgurl.setAttribute("width", 50);
            imgurl.setAttribute("height", 50);
            imgCell.appendChild(imgurl);
            imgCell.setAttribute("class", "TblCell");


            const numCell = document.createElement("td");
            const num = document.createTextNode((cur + i + 1).toString());
            numCell.appendChild(num);
            numCell.setAttribute("class", "TblCell");
            row.appendChild(numCell);


            row.appendChild(imgCell);


            const trackCell = document.createElement("td");
            var name = item.track.name;
            trackDict["name"] = name;
            if (name.length > 25){
                name = name.slice(0, 25) + "...";
            }
            const trackName = document.createTextNode(name);
            trackCell.appendChild(trackName);
            trackCell.setAttribute("class", "TblCell");
            row.appendChild(trackCell);


            const artistCell = document.createElement("td");
            name = item.track.artists[0].name;
            trackDict["artist"] = name;
            if (name.length > 25){
                name = name.slice(0, 25) + "...";
            }
            const artistName = document.createTextNode(name);
            artistCell.appendChild(artistName);
            artistCell.setAttribute("class", "TblCell");
            row.appendChild(artistCell);

            const energyCell = document.createElement("td");
            
            // energyCell.appendChild(trackEnergy);
            energyCell.setAttribute("class", "TblCell");
            energyCell.setAttribute("id", (item.track.id + (i.toString())));
            row.appendChild(energyCell);

            tblBody.appendChild(row);
            pldict[item.track.id] = trackDict;
            ids.push(item.track.id)
            idswOrder.push(item.track.id + (i.toString()))
            names.push(item.track.name)
            pldict.cur += 1
        }
        catch{
            console.log("error on track " + (i + 1).toString());;
        }
    }
    document.getElementById("OutputTracks").appendChild(tblBody)
    if (!append){
        pldict["curIDs"] = idswOrder
    }
    else{
        pldict["curIDs"] = pldict["curIDs"].concat(idswOrder)
    }
    
    if (check){
        getFeatures(ids, names, idswOrder, pldict)
    }
    
    curIDs = ids
    curNames = names
}


function setChart(yValues, names, min, max, append){
    
    // Reset the canvas
    const element = document.getElementById('chartWrapper');
    if (element){
        element.remove();
    }
    var chart1 = document.getElementById("chart1")
    const chartWrap = document.createElement("div")
    chartWrap.setAttribute("class", "chartWrapper")
    chartWrap.setAttribute("id", "chartWrapper")
    let canvas = document.createElement("canvas")
    canvas.setAttribute("id", "myChart")
    canvas.setAttribute("style", "width:95%;max-width:1000px;")
    
    chartWrap.appendChild(canvas)
    // chart1.appendChild(chartWrap)

    var xValues = names;

    // xValues = xValues.slice(1, xValues.length)
    if (graph == null)  {
      
        
      graph = new Chart("chosenChart", {
        type: "line",
        data: {
            labels: xValues,
            datasets: [{
                pointRadius: 4,
                data: yValues,
                fill: false,
                borderColor: '#1DB954',
                tension: 0.1,
                pointBackgroundColor: "white"
            },
            {
                pointRadius: 0,
                data: [],
                fill: false,
                borderColor: '#27362b',
                pointHoverRadius: 0,
                
                pointBackgroundColor: "white"
            }],
            
        },
        options: {
          layout: {
              padding: {
                  left: 20,
                  right: 20,
                  top: 6,
                  bottom: 6
              }
          },
          legend: {display: false},
          scales: {
            xAxes: [{display: false}],
            yAxes: [{display: false}],
          },
        }
      });
    }
    else{
        // console.log(yValues)
        if (append){ 
            

            // console.log(graph)
            graph.data.datasets[0].data = graph.data.datasets[0].data.concat(yValues)
            graph.data.labels = graph.data.labels.concat(names)
            // console.log(graph)
            if (graph.options.scales.yAxes[0].ticks.min < min - 2){
                graph.options.scales.yAxes[0].ticks.min = min - 2
            }
            
            if (graph.options.scales.yAxes[0].ticks.max > max + 2){
                graph.options.scales.yAxes[0].ticks.max = max + 2
            }
            
            
            
        }
        else{

            console.log("Test")
            document.getElementById("chosenChart").remove()
            chld = document.createElement("canvas")
            chld.setAttribute("id", "chosenChart")
            document.getElementById("chosenGraph").appendChild(chld)
            
            graph = graph = new Chart("chosenChart", {
                type: "line",
                data: {
                    labels: xValues,
                    datasets: [{
                        pointRadius: 4,
                        data: yValues,
                        fill: false,
                        borderColor: '#1DB954',
                        tension: 0.1,
                        pointBackgroundColor: "white"
                    },
                    {
                        pointRadius: 0,
                        data: [],
                        fill: false,
                        borderColor: '#27362b',
                        pointHoverRadius: 0,
                        
                        pointBackgroundColor: "white"
                    }],
                    
                },
                options: {
                  layout: {
                      padding: {
                          left: 20,
                          right: 20,
                          top: 6,
                          bottom: 6
                      }
                  },
                  legend: {display: false},
                  scales: {
                    xAxes: [{display: false}],
                    yAxes: [{display: false, ticks: {min: min - 2, max: max + 2}}],
                  },
                }
              });
            // graph.options.scales.yAxes[0].ticks.min = min - 2
            // graph.options.scales.yAxes[0].ticks.max = max + 2
            
        }
        
        
        graph.data.datasets[1].data = [0]
        
        graph.update()
    }
    document.getElementById("chooseGraph").style.display = 'flex'; 
    document.getElementById("subtitle2").style.display = 'block'; 
    if (first){
        first = false;
        newCharts(); 
    }
    
    if (curTarget){
        reorderedGraph(curTarget[0], curTarget[1], curTarget[2], curTarget[3], curTarget[4], curTarget[5], curTarget[6])
    }
    
}

function defChart(name, a, b, c, d, e, f, g){
    new Chart(name, {
        type: "line",
        data: {
            labels:range(1, 40, 1),
            datasets: [{
                pointRadius: 0,
                data: range(1, 40, 1).map(function(item, index) { return d*Math.sin((item + g) * a) - f * (((item + g) * (item + g))/b) + e*item + c;}),
                fill: false,
                borderColor: '#1DB954',
                
                pointBackgroundColor: "white"
            }],
            
        },
        options: {
            //TODO: Figure out why tooltips are still there rip
            plugins: {
                tooltip: {
                  enabled: false 
                }
              },
          layout: {
              padding: {
                  left: 20,
                  right: 20,
                  top: 6,
                  bottom: 6
              }
          },
          legend: {display: false},
          scales: {
            xAxes: [{display: false}],
            yAxes: [{display: false}],
          },
        }
      });
}

function newCharts(length){


    defChart("bottomTop", 0, -9000000, 9, 0, 1, 0, 0)
    defChart("topBottom", 0, 9000000, 9, 0, -1, 0, 0)
    defChart("curvyUp", 0.5, -30, 9, 7, 0, 1, 0)
    defChart("curvyDown", 0.5, 175, 9, 1, 0, 1, 0)
    defChart("droop", 0.157079632, 1, 40, 40, 0, 0, 10)
    defChart("hill", 0.157079632, 1, 40, 40, 0, 0, -10)

}

function findBestFit(set2, set1){
    
    let order = [];
    for (let i = 0; i < set2.length; i++){
        order.push({"val": set2[i], "orig": i})
    }

    order.sort((a, b) => parseFloat(a.val) - parseFloat(b.val));
    set1.sort((a, b) => parseFloat(a.energy) - parseFloat(b.energy));


    let final = [];
    for (let i = 0; i < set2.length; i++){
    for (let j = 0; j < set2.length; j++){
        if (order[j].orig === i){
        final.push(set1[j])
        break;
        }
        
        }
    }
    return final
    
}

function getMaxMin(el){
    let max = 0
    let min = 10000000000
    for (let i = 0; i < el.length; i++){
        let energy = el[i].energy
        if (energy > max){
            max = energy
        }
        if (energy < min){
            min = energy
        }
    }
    return [min, max]
}

function reorderedGraph(a, b, c, d, e, f, g){
    if (!getCheckBoxes().every(element => element === false)){
        chartNotSet = true
        document.getElementById("exportButton").style.display = 'block'
        
        if (newPL){
            var out = getPLList();
            var curPL = out[0];
            // console.log(out)
            var min = out[1];
            var max = out[2];
            
        }
        else{
            // console.log(energyList)
            var curPL = energyList
            let out = getMaxMin(energyList)
            var min = out[0]
            var max = out[1]
        }

        curTarget = [a, b, c, d, e, f, g];
        
        let length = Object.keys(pldict).length;
        
        // let xVals = [...Array(length).keys()]
        let xVals = range(40 / length, 40, 40 / length);
        
        let target = xVals.map(function(item, index) { return d*Math.sin((item + g) * a) - f*(((item + g) * (item + g))/b) + e*(item + g) + c;});

        target = scaledTarget(target, min, max)
        
        matched = findBestFit(target, curPL)

        let matchedLabels = [];
        let matchedData = [];
        for (let i = 0; i < matched.length; i++){
            if (matched[i]){

                matchedLabels.push(pldict[matched[i].id].name)
                matchedData.push(matched[i].energy)
            }
            
        }

        // console.log(document.getElementById("3zWgFhqjlGiM7p1ECrxclH").innerHTML)

        // SIN(A * n) - ((n **2)/B) + C
        // let diff = a.map(function(item, index) { return Math.abs(item - b[index]);});
        graph.data.labels = matchedLabels
        graph.data.datasets[0].data = matchedData
        graph.data.datasets[1].data = target
        
        graph.update();

        let finalOut = formatDict(matched)
        
        handleTracksResponse1(finalOut, false, false)
    }
    
}

function formatDict(ordered){

    let out = {"items": []};
    for (let i = 0; i < ordered.length; i++){
        if (ordered[i]){
            let track = pldict[ordered[i].id]
            out.items.push({"track": {"id": ordered[i].id, "name": track.name, "artists": [{"name": track.artist}], "album": {"images": [{"url": track.url}]}, "energy": ordered[i].energy}})
        }
    }
    return out

}

function scaledTarget(target, min, max){
        let out = []
        let max1 = Math.max(...target)
        let min1 = Math.min(...target)
        for (let i = 0; i < target.length; i++){
            out.push(max - (target[i] - min1)/(max1 - min1) * (max - min))
        }
        
        out.reverse()
        return out
}

function getPLList(){
    let out = [];
    let max = 0;
    let min = 10000000000;
    var count = -1
    //FIXME: this isn't working with doubles because dicts dont allow doubles
    //maybe iterate over curids? i dunno...
    // for (const [key, value] of Object.entries(pldict)) {
    for (let i = 0; i < pldict.curIDs.length; i++){
        count += 1
        try{
            cur = pldict.curIDs[i]
            energy = +document.getElementById(cur).innerHTML
            if (!isNaN(energy)){
                const trackEnergy = document.createTextNode(energy.toString());
                document.getElementById(cur).appendChild(trackEnergy)
                if (energy > max){
                    max = energy
                }
                if (energy < min){
                    min = energy
                }
                
                for (const [key, value] of Object.entries(pldict)){
                    if (cur.startsWith(key)){
                        out.push({"id": key, "energy": energy})
                        break
                    }
                }

                
           }
        }
        catch{}        
    }
    // console.log(out)
    energyList = out
    newPL = false
    // console.log("NewPL is false")
    return [out, min, max]
}

function getUserInfo(){
    hideDialog()
    callApi("GET", "https://api.spotify.com/v1/me", null, exportPlaylist)
    
}

function exportPlaylist(){
    if ( this.status == 200 ){
        var name = document.getElementById("plName").value
        if (name == ''){
            name = "Default rip"
        }
        let id = JSON.parse(this.responseText)['display_name'];
        let body = {"name": name,"description": "This Playlist was reordered with FlowifyMusic.com!","public": false};
        callApi("POST", "https://api.spotify.com/v1/users/{id}/playlists".replace("{id}", id), JSON.stringify(body), exportTracks);
    }
    else if ( this.status == 204 ){
        console.log("Lmao rip I guess")
    }
    else if ( this.status == 401 ){
        refreshAccessToken()
    }
    else {
        console.log(this.responseText);
        alert(this.responseText);
    }

}

async function exportTracks(){
    // console.log(Math.ceil(matched.length / 100))
    
    let id = JSON.parse(this.responseText).id
    var count = 0;
    var successful = 0;
    for (let x = 0; x < Math.ceil(matched.length / 99); x++){
        // console.log(x)
        
        var url = "https://api.spotify.com/v1/playlists/{playlist_id}/tracks?position={count}&uris=".replace("{playlist_id}", id).replace("{count}", successful)

        for (let i = 0; i < 99; i++){
            if (matched[count]){
                successful += 1
                url += "spotify:track:"
                // console.log(matched)
                url += matched[count].id
                url += ","
            }
            count += 1
            if (count > matched.length){
                console.log("breaking at " + count.toString())
                break;
            }
        }
        
        url = url.slice(0,-1)
        
        console.log(url)
        callApi("POST", url, null, null)
        await new Promise(r => setTimeout(r, 500));
    }
    // console.log(url)
    
}


// var dialog = document.querySelector('dialog');
// dialogPolyfill.registerDialog(dialog);

function openDialog(){
    if (matched != null){
        let modal = document.getElementById("myModal");
        modal.style.display = "block";
    }
}

function hideDialog(){
    let modal = document.getElementById("myModal");
    modal.style.display = "none";
    // document.getElementById("dialogBox").close()
}

window.onclick = function(event) {
    let modal = document.getElementById("myModal");
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function changeFeature(newFeature){
    curTrait = newFeature
    if (curIDs){
        HandlePlaylistChange()
    }
}