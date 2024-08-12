// State Variables
let currentPlaylist = "";
let radioButtons = [];
let graph = null;
let curTrait = "energy";
let first = true;
let curIDs = null;
let curNames = null;
let traits = ["energy", "danceability", "acousticness", "speechiness", "liveness", "instrumentalness"];

var trackResponse = null
var curTarget = null;
var pldict = {"cur": 0, "curIDs": []};
var matched = null;
var chartNotSet = true;
var outCopy = {"items": []}
var energyList = {};
var newPL = false;
var newPL2 = false;


// Utility Functions
const range = (start, stop, step) => Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step));

document.addEventListener('DOMContentLoaded', fetchPlaylists);

function fetchPlaylists() {
    // console.log("fetching playlists")
    fetch('http://localhost:3000/user-playlists')
    .then(response => response.json())
    .then(playlistsData => {
        handlePlaylistsResponse(playlistsData)
    })
    .catch(error => console.error('Error fetching playlists:', error));
}


function handlePlaylistsResponse(playlistsData){
    // console.log(playlistsData)
    removeAllItems("playlists");
    playlistsData.items.forEach(item => addPlaylist(item));
    document.getElementById('playlists').value=currentPlaylist;
}

function fetchTracks(playlistId) {
    // Return the fetch promise chain
    return fetch(`http://localhost:3000/playlist-tracks/${playlistId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error fetching playlist tracks:', error);
            throw error;  // Re-throw the error to be handled in the calling function
        });
}


async function getFeatures(ids, names, idswOrder) {
    console.log("GETTING FEATURES!")
    try {
        const response = await fetchAudioFeatures(ids);
        const data = await validateResponse(response);

        const { energies, minEnergy, maxEnergy } = processAudioFeatures(data.audio_features, names, idswOrder);

        updateUI(energies, names, minEnergy, maxEnergy);
    } catch (error) {
        console.error('Error in getFeatures:', error);
    }
}

async function fetchAudioFeatures(ids) {
    const response = await fetch(`http://localhost:3000/audio-features?ids=${ids.join(',')}`);
    if (!response.ok) {
        throw new Error('Failed to fetch audio features');
    }
    return response;
}

async function validateResponse(response) {
    return await response.json();
}

function processAudioFeatures(audioFeatures, names, idswOrder) {
    let energies = [];
    let minEnergy = 100000;
    let maxEnergy = 0;

    const checkedBoxes = getCheckBoxes();
    if (checkedBoxes.every(element => element === false)) {
        setFlowWave();
        return { energies, minEnergy, maxEnergy };
    }

    audioFeatures.forEach((feature, index) => {
        try {
            let energyVal = calculateEnergy(feature, checkedBoxes);
            minEnergy = Math.min(minEnergy, energyVal);
            maxEnergy = Math.max(maxEnergy, energyVal);

            updateEnergyDisplay(idswOrder[index], energyVal);
            energies.push(energyVal);
        } catch (e) {
            console.log(e);
            removeInvalidName(feature.id, names);
        }
    });

    return { energies, minEnergy, maxEnergy };
}

function calculateEnergy(feature, checkedBoxes) {
    let energyVal = 0;
    let count = 0;
    for (let j = 0; j < traits.length; j++) {
        if (checkedBoxes[j]) {
            if (feature){
                energyVal += feature[traits[j]];
                count += 1;
            }
        }
    }
    return Math.round((energyVal / count) * 1000) / 10;
}

function updateEnergyDisplay(elementId, energyValue) {
    var energySpan = document.getElementById(elementId);
    const trackEnergy = document.createTextNode(energyValue);
    energySpan.appendChild(trackEnergy);
}

function removeInvalidName(featureId, names) {
    const idx = names.indexOf(featureId);
    if (idx > -1) {
        names.splice(idx, 1);
    }
}

function updateUI(energies, names, minEnergy, maxEnergy) {
    if (newPL2) {
        setChart(energies, names, minEnergy, maxEnergy, false);
        newPL2 = false;
    } else {
        setChart(energies, names, minEnergy, maxEnergy, true);
    }
}



async function fetchUserProfile() {
    try {
        const response = await fetch('http://localhost:3000/user-profile');
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        const userProfile = await response.json();
        return userProfile.id; // This is the Spotify User ID
    } catch (error) {
        console.error('Error fetching user profile:', error);
        // Handle error appropriately
    }
}

async function exportPlaylist() {
    const name = document.getElementById("plName").value || "Default rip";
    const userId = await fetchUserProfile();
    const body = {
        userId: userId,
        name: name,
        description: "This Playlist was reordered with FlowifyMusic.com!"
    };

    try {
        const response = await fetch('http://localhost:3000/create-playlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error('Failed to create playlist');
        }

        const playlistData = await response.json();
        exportTracks(playlistData.id);
    } catch (error) {
        console.error('Error in exportPlaylist:', error);
        alert(error.message);
    }
}

async function exportTracks(playlistId) {
    for (let i = 0; i < matched.length; i += 99) {
        const trackBatch = matched.slice(i, i + 99).map(track => `spotify:track:${track.id}`);
        try {
            await fetch('http://localhost:3000/add-tracks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ playlistId: playlistId, tracks: trackBatch })
            });
            await new Promise(r => setTimeout(r, 500)); // Rate limiting
        } catch (error) {
            console.error('Error adding tracks:', error);
            // Handle error
        }
    }
}










// Handling DOM content
function getCheckBoxes(){
    
    let states = [];
    for (let i = 0; i < traits.length; i++){
        states.push(document.getElementById(traits[i]).checked)
    }
    return states
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

async function HandlePlaylistChange(){
    newPL = true
    newPL2 = true
    document.getElementById("flex-container").style.display = "flex"
    curPlaylist_ID = document.getElementById("playlists").value;
    let trackData = await fetchTracks(curPlaylist_ID)
    handleTracksResponse(trackData)
}

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




























//yuck... Don't even make me look at this
async function handleTracksResponse(data){
    document.getElementById("flex-container").style.display = "none";
    document.getElementById("tracks").style.display = "block";
    document.getElementById("chosenGraph").style.display = 'block';


    var tblBody = null;
    var ids = [];
    
    
    pldict = {"cur": 0, "curIDs": []};
    document.getElementById("TableBody").remove()
    tblBody = document.createElement("tbody");
    tblBody.setAttribute("id", "TableBody");
    

    var cur = pldict.cur
    var names = [];
    var idswOrder = [];
    
    for (let i = 0; i < data.length; i++){
        try{
            let item = data[i];

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
    
    pldict["curIDs"] = idswOrder
    
    if (newPL2){

        getFeatures(ids, names, idswOrder, pldict)
    }
    
    curIDs = ids
    curNames = names
}

async function setFlowWave(){
    //Show a loading wave while nothing else is selected
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

function setChart(yValues, names, min, max, append){
    //Set the chart to new values
    
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

function findBestFit(target, songs){
//     console.log('finding best fit')
//     console.log('target:', target)
//     console.log('songs:', songs)
    
    let order = [];
    for (let i = 0; i < target.length; i++){
        order.push({"val": target[i], "orig": i})
    }

    order.sort((a, b) => parseFloat(a.val) - parseFloat(b.val));
    songs.sort((a, b) => parseFloat(a.energy) - parseFloat(b.energy));

    let final = [];
    for (let i = 0; i < target.length; i++){
        for (let j = 0; j < target.length; j++){
            if (order[j].orig === i){
                final.push(songs[j])
                break;
            }
            
        }
    }
    return final
}

function getMinMax(energyList){
    let max = 0
    let min = 10000000000
    for (let i = 0; i < energyList.length; i++){
        let energy = energyList[i].energy
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
            let out = getMinMax(energyList)
            var min = out[0]
            var max = out[1]
        }

        curTarget = [a, b, c, d, e, f, g];
        
        let length = Object.keys(pldict).length;
        
        // let xVals = [...Array(length).keys()]
        let xVals = range((40 / length), 40, 40 / length);
        
        let target = xVals.map(function(item, index) { return d*Math.sin((item + g) * a) - f*(((item + g) * (item + g))/b) + e*(item + g) + c;});

        target = scaledTarget(target, min, max)
        // console.log('curPL', curPL)
        matched = findBestFit(target, curPL)

        // console.log('target:', target)
        // console.log('matched:', matched)

        let matchedLabels = [];
        let matchedData = [];
        for (let i = 0; i < matched.length; i++){
            if (matched[i]){
                matchedLabels.push(pldict[matched[i].id].name)
                matchedData.push(matched[i].energy)
            }
            
        }

        // SIN(A * n) - ((n **2)/B) + C
        // let diff = a.map(function(item, index) { return Math.abs(item - b[index]);});
        graph.data.labels = matchedLabels
        graph.data.datasets[0].data = matchedData
        graph.data.datasets[1].data = target
        
        graph.update();

        let finalOut = formatDict(matched)
        
        handleTracksResponse(finalOut.items, false, false)
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


