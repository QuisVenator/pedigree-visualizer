let selectedHorseId = null;

const getHorse = (id) => horses.find(h => h.id === id);

function calculateScore(id) {
    const horse = getHorse(id);
    if (!horse) return 0;

    if (horse.isHoF) return 100;

    const sireScore = calculateScore(horse.sireId);
    const damScore = calculateScore(horse.damId);

    return (sireScore / 2) + (damScore / 2);
}


const width = document.getElementById('graph-container').clientWidth;
const height = document.getElementById('graph-container').clientHeight;

const svg = d3.select("#graph-container").append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(d3.zoom().on("zoom", (e) => mainGroup.attr("transform", e.transform)));

const mainGroup = svg.append("g").attr("transform", "translate(50, 0)");

const linkLayer = mainGroup.append("g").attr("class", "link-layer");
const nodeLayer = mainGroup.append("g").attr("class", "node-layer");

// Thickness: 0% = 1px, 100% = 8px
const thicknessScale = d3.scaleSqrt().domain([0, 100]).range([1, 8]); 
// Color: 0% = Light Gray, 100% = Gold
const colorScale = d3.scaleSqrt().domain([0, 100]).range(["#cccccc", "#d4af37"]); 

function renderTree() {
    const buildHierarchy = (id) => {
        const h = getHorse(id);
        if (!h) return null;
        
        const node = { ...h, score: calculateScore(id) };
        const children = [];
        
        const sire = buildHierarchy(h.sireId);
        const dam = buildHierarchy(h.damId);
        
        if (sire) children.push(sire);
        if (dam) children.push(dam);
        
        if (children.length) node.children = children;
        return node;
    };

    if (!horses || horses.length === 0) return;

    const rootData = buildHierarchy(horses[0].id);
    if (!rootData) return;


    const root = d3.hierarchy(rootData);

    // Used to dynamically set height
    const levelWidth = [1];
    const childCount = (level, n) => {
        if (n.children && n.children.length > 0) {
            if (levelWidth.length <= level + 1) levelWidth.push(0);
            levelWidth[level + 1] += n.children.length;
            n.children.forEach(d => childCount(level + 1, d));
        }
    };
    childCount(0, root);

    const newHeight = d3.max(levelWidth) * 80; 
    d3.select("svg").attr("height", newHeight + 100);

    const treeLayout = d3.tree().size([newHeight-100, width - 200]);
    console.log(`Old height  was ${height} and widht was ${width}`);
    console.log(`Dynamic height is ${newHeight} and width is ${width - 200}`)
    treeLayout(root);

    const links = linkLayer.selectAll(".link")
        .data(root.links(), d => d.target.data.id);
    
    const linkEnter = links.enter().append("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke-width", d => thicknessScale(d.target.data.score))
        .attr("stroke", d => colorScale(d.target.data.score))
        .attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x)
        );
        
    links.exit().remove();

    const nodes = nodeLayer.selectAll(".node")
        .data(root.descendants(), d => d.data.id);

    const nodeEnter = nodes.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`)
        .on("click", (e, d) => selectHorse(d.data.id));

    const symbolGenerator = d3.symbol()
        .size(700) 
        .type(d => {
            if (d.data.sex === 'male') return d3.symbolSquare;
            return d3.symbolCircle;
        });

    nodeEnter.append("path")
        .attr("d", symbolGenerator);
    
    nodeEnter.append("text")
        .attr("dy", -20)
        .attr("text-anchor", "middle")
        .text(d => d.data.name);

    nodeEnter.append("text")
        .attr("dy", 4)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(d => d.data.score + "%");

    const nodeUpdate = nodes.merge(nodeEnter);
    
    nodeUpdate.transition().duration(500)
        .attr("transform", d => `translate(${d.y},${d.x})`);

    nodeUpdate.attr("class", d => {
        let classes = "node";
        if (d.data.isHoF) classes += " hof";
        if (d.data.id === selectedHorseId) classes += " selected";
        return classes;
    });

    nodeUpdate.select("text").text(d => d.data.name);
    nodeUpdate.select("text:last-child").text(d => Number(d.data.score.toFixed(2)) + "%");

    nodes.exit().remove();
}


function selectHorse(id) {
    selectedHorseId = id;
    const horse = getHorse(id);
    const score = calculateScore(id);

    document.getElementById("empty-state").style.display = "none";
    const panel = document.getElementById("selected-horse-panel");
    panel.style.display = "block";
    
    document.getElementById("panel-name").textContent = horse.name;
    document.getElementById("panel-status").textContent = horse.isHoF ? "Ja (100%)" : "Nein";
    document.getElementById("panel-score").textContent = score.toFixed(10) + "%";


    const sireSelect = document.getElementById("existing-sire-select");
    const damSelect = document.getElementById("existing-dam-select");
    
    sireSelect.innerHTML = "";
    damSelect.innerHTML = "";

    const otherHorses = horses.filter(h => h.id !== id);
    otherHorses.sort((a, b) => a.name.localeCompare(b.name));

    otherHorses.forEach(h => {
        const option = document.createElement("option");
        option.value = h.id;
        option.textContent = h.name;
        
        if (h.sex === 'male') {
            sireSelect.appendChild(option);
        } else {
            damSelect.appendChild(option);
        }
    });

    document.getElementById("link-existing-panel").style.display = "block";
    
    document.getElementById("btn-add-sire").style.display = horse.sireId ? "none" : "inline-block";
    document.getElementById("btn-add-dam").style.display = horse.damId ? "none" : "inline-block";
    document.getElementById("btn-remove-sire").style.display = horse.sireId ? "inline-block" : "none";
    document.getElementById("btn-remove-dam").style.display = horse.damId ? "inline-block" : "none";

    d3.selectAll(".node").classed("selected", false);
    d3.selectAll(".node")
        .filter(d => d.data.id === id)
        .classed("selected", true);
}

function toggleHoF() {
    if (!selectedHorseId) return;
    const horse = getHorse(selectedHorseId);
    horse.isHoF = !horse.isHoF;

    saveToLocal();

    renderTree();
    selectHorse(selectedHorseId);
};

function editName() {
    if (!selectedHorseId) return;
    const horse = getHorse(selectedHorseId);

    const newName = prompt("Neuer Name für dieses Pferd:", horse.name);
    if (!newName || newName.trim() === "") return;
    
    horse.name = newName.trim();
    
    saveToLocal();
    renderTree();
    
    // We manually update the text here so we don't have to re-select the horse
    document.getElementById("panel-name").textContent = horse.name;
}

function addParent(type) {
    if (!selectedHorseId) return;
    const child = getHorse(selectedHorseId);
    
    const newSex = type === "Vatertier" ? "male" : "female";
    const newId = "h" + (Math.random() * 10000).toFixed(0);
    const newName = prompt(`Namen des ${type}:`, `${type} of ${child.name}`);
    
    if (!newName) return;

    const newHorse = {
        id: newId,
        name: newName,
        isHoF: false,
        sireId: null,
        damId: null,
        sex: newSex
    };
    
    horses.push(newHorse);

    if (type === "Vatertier") child.sireId = newId;
    else child.damId = newId;

    saveToLocal();

    renderTree();
    selectHorse(selectedHorseId);
}

function linkExisting(type) {
    if (!selectedHorseId) return;

    const child = getHorse(selectedHorseId);
    
    if (type === "Vatertier") {
        parentId = document.getElementById("existing-sire-select").value;
    } else {
        parentId = document.getElementById("existing-dam-select").value;
    }
    
    if (!parentId) {
        alert("Bitte ein " + type + " auswählen.");
        return;
    }

    if (checksForCycle(selectedHorseId, parentId)) {
        alert("Zeitreisende Pferde werden aktuell noch nicht unterstützt!\n(Die versuchte Verbindung würde ein Tier zu seinem eigenen Vorfahren machen)");
        return;
    }

    if (type === "Vatertier") {
        child.sireId = parentId;
    } else {
        child.damId = parentId;
    }

    saveToLocal();
    renderTree();
    selectHorse(selectedHorseId);
}

function checksForCycle(childId, potentialParentId) {
    if (!potentialParentId) return false;
    if (childId === potentialParentId) return true;

    function isAncestor(currentId, targetId) {
        if (!currentId) return false;
        if (currentId === targetId) return true; // Time travel breedin detected!
        
        const current = getHorse(currentId);
        return isAncestor(current.sireId, targetId) || isAncestor(current.damId, targetId);
    }

    return isAncestor(potentialParentId, childId);
}

function removeParent(type) {
    if (!selectedHorseId) return;
    const child = getHorse(selectedHorseId);
    
    if (type === "Vatertier") child.sireId = null;
    else child.damId = null;
    cleanupOrphans();

    saveToLocal();

    renderTree();
    selectHorse(selectedHorseId);
}

// --- GARBAGE COLLECTION ---
function cleanupOrphans() {
    const activeIds = new Set();

    function markActive(id) {
        if (!id || activeIds.has(id)) return;
        
        activeIds.add(id);
        
        const horse = getHorse(id);
        if (horse) {
            markActive(horse.sireId);
            markActive(horse.damId);
        }
    }

    markActive("h1");

    const beforeCount = horses.length;
    horses = horses.filter(h => activeIds.has(h.id));
    
    const deletedCount = beforeCount - horses.length;
    if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} loose nodes.`);
    }
}

document.getElementById("btn-toggle-hof").onclick = () => toggleHoF();
document.getElementById("btn-add-sire").onclick = () => addParent("Vatertier");
document.getElementById("btn-add-dam").onclick = () => addParent("Muttertier");
document.getElementById("btn-remove-sire").onclick = () => removeParent("Vatertier");
document.getElementById("btn-remove-dam").onclick = () => removeParent("Muttertier");


function exportData() {
    const dataStr = JSON.stringify(horses, null, 2); // Pretty print JSON
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Create a fake link and click it to trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = "horse_pedigree_data.json";
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (Array.isArray(json)) {
                horses = json;
                selectedHorseId = null;
                
                document.getElementById("selected-horse-panel").style.display = "none";
                document.getElementById("empty-state").style.display = "block";

                saveToLocal();
                
                renderTree(); 
                alert("Daten wurden erfolgreich importiert!");
            } else {
                alert("Fehler: Falsches Format");
            }
        } catch (err) {
            alert("Fehler beim Lesen der Datei: " + err);
        }
    };
    
    reader.readAsText(file);
    // Reset input so we can load the same file again if needed
    inputElement.value = ""; 
}


const STORAGE_KEY = "horse_app_data_v1";
function saveToLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(horses));
    console.log("Data auto-saved!"); 
}

function loadFromLocal() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        return JSON.parse(savedData);
    }
    return null;
}

function resetData() {
    if (confirm("Sind Sie sicher? Dies löscht alle Daten und startet einen neuen Stammbaum.")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

function createRootHorse() {
    // TODO: Change to modal
    let name = prompt("Willkomen! Bitte Named des analysierten Pferdes angeben:");
    if (!name || name.trim() === "") {
        name = "Mein Pferd";
    }

    // 2. Ask for Gender
    // TODO: Change to modal
    const isMale = confirm(`Ist "${name}" ein Hengst?\n\nOK für Hengs.\nCancel für Stute.`);
    const sex = isMale ? 'male' : 'female';

    const rootHorse = {
        id: "h1",
        name: name,
        isHoF: false,
        sireId: null,
        damId: null,
        sex: sex
    };

    horses = [rootHorse];
    saveToLocal();
    renderTree();
}

// --- Start! ---
let horses = loadFromLocal()
if (!horses || horses.length === 0) {
    createRootHorse();
} else {
    renderTree();
}
