const express = require('express');
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const app = express();
const port = 8080;

const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];

for (let folder of vect_foldere) {
    let caleFolder = path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder);
        console.log(`Folderul '${folder}' a fost creat automat.`);
    }
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let obGlobal = {
    obErori: null,
    folderScss: path.join(__dirname, 'resurse', 'scss'),
    folderCss: path.join(__dirname, 'resurse', 'css')
};

if (!fs.existsSync(obGlobal.folderScss)) fs.mkdirSync(obGlobal.folderScss, { recursive: true });
if (!fs.existsSync(obGlobal.folderCss)) fs.mkdirSync(obGlobal.folderCss, { recursive: true });


let dateGalerie = { imagini: [] };
try {
    let continutGal = fs.readFileSync(path.join(__dirname, 'galerie.json'), 'utf-8');
    dateGalerie = JSON.parse(continutGal);
} catch (e) {
    console.error("⚠️ Lipseste fisierul galerie.json sau e invalid!", e.message);
}
// ==========================================
// BONUS 5: Verificare galerie.json
// ==========================================
function verificaGalerieJson() {
    // Verificăm dacă există proprietatea cale_galerie
    if (!dateGalerie.cale_galerie) {
        console.error("⚠️ EROARE BONUS 5: JSON-ul nu conține proprietatea 'cale_galerie'. Adăugați-o pentru a remedia problema.");
        return;
    }

    let caleFolderAbsoluta = path.join(__dirname, dateGalerie.cale_galerie);

    if (!fs.existsSync(caleFolderAbsoluta)) {
        console.error(`⚠️ EROARE BONUS 5 (a): Folderul specificat în 'cale_galerie' (${dateGalerie.cale_galerie}) NU există în sistemul de fișiere! Pentru a remedia, creați folderul respectiv.`);
    } else {
    
        let existaCelPutinOImagine = false;

        if (dateGalerie.imagini && Array.isArray(dateGalerie.imagini)) {
            for (let img of dateGalerie.imagini) {
                let numeFisierImg = img.cale_imagine || img.fisier || img.src; 
                if (numeFisierImg) {
                    let caleImagine = path.join(caleFolderAbsoluta, numeFisierImg);
                    if (fs.existsSync(caleImagine)) {
                        existaCelPutinOImagine = true;
                        break; 
                    }
                }
            }
        }

        if (!existaCelPutinOImagine) {
            console.error("⚠️ EROARE BONUS 5 (b): Nu există (în sistemul de fișiere) VREUNUL dintre fișierele imagine specificate în lista de imagini din JSON! Pentru a remedia, asigurați-vă că pozele menționate chiar au fost copiate în folder.");
        } else {
            console.log("✅ BONUS 5: Verificarea galeriei a trecut cu succes. Folderul și imaginile sunt la locul lor.");
        }
    }
}
verificaGalerieJson();

// === CONEXIUNEA LA BAZA DE DATE POSTGRESQL ===
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'fitflow',
    password: '1234',
    port: 5432,
});

let dateProduse = [];

pool.query('SELECT * FROM produse').then(rezultat => {
    dateProduse = rezultat.rows;
    
    // Transformăm echipamentul din string (cum vine din SQL) în Array (cum îl cere EJS-ul tău)
    dateProduse.forEach(p => {
        if (typeof p.echipament === 'string') {
            p.echipament = p.echipament.split(',');
        }
    });

    app.locals.categoriiMeniu = [...new Set(dateProduse.map(p => p.categorie))];
    console.log("✅ SUCCES MAXIM: 100% Datele au fost trase din baza de date PostgreSQL!");
}).catch(err => {
    console.error("❌ EROARE BAZA DE DATE:", err.message);
});

function verificaEroriJson() {
    const caleFisier = path.join(__dirname, 'erori.json');


    if (!fs.existsSync(caleFisier)) {
        console.error("❌ EROARE CRITICĂ (A): Fișierul 'erori.json' lipsește cu desăvârșire din proiect! Serverul se va închide.");
        process.exit(); 
    }

    const continutString = fs.readFileSync(caleFisier, 'utf-8');

    
    const regexObiecte = /\{[^{}]*\}/g; 
    let matchObiect;
    while ((matchObiect = regexObiecte.exec(continutString)) !== null) {
        let obiectString = matchObiect[0];
        const regexChei = /"([^"]+)"\s*:/g; 
        let cheiGasite = [];
        let matchCheie;
        while ((matchCheie = regexChei.exec(obiectString)) !== null) {
            let numeCheie = matchCheie[1];
            if (cheiGasite.includes(numeCheie)) {
                console.error(`⚠️ EROARE (F): Proprietatea "${numeCheie}" apare de mai multe ori în același obiect!`);
            }
            cheiGasite.push(numeCheie);
        }
    }

    let dateJson;
    try {
        dateJson = JSON.parse(continutString);
    } catch (err) {
        console.error("❌ EROARE: Fișierul nu este un JSON valid!", err.message);
        process.exit();
    }

    
    if (!dateJson.info_erori || !dateJson.cale_baza || !dateJson.eroare_default) {
        console.error("⚠️ EROARE (B): Lipsesc proprietăți esențiale din JSON!");
    }

    
    if (dateJson.eroare_default) {
        if (!dateJson.eroare_default.titlu || !dateJson.eroare_default.text || !dateJson.eroare_default.imagine) {
            console.error("⚠️ EROARE (C): Obiectul 'eroare_default' este incomplet!");
        }
    }

    
    if (dateJson.cale_baza) {
        let caleFolderAbsoluta = path.join(__dirname, dateJson.cale_baza);
        if (!fs.existsSync(caleFolderAbsoluta)) {
            console.error(`⚠️ EROARE (D): Folderul specificat în 'cale_baza' NU există!`);
        }
        
        else {
            if (dateJson.eroare_default && dateJson.eroare_default.imagine) {
                let caleImgDefault = path.join(caleFolderAbsoluta, dateJson.eroare_default.imagine);
                if (!fs.existsSync(caleImgDefault)) {
                    console.error(`⚠️ EROARE (E): Imaginea default NU există pe disc!`);
                }
            }

            if (Array.isArray(dateJson.info_erori)) {
                dateJson.info_erori.forEach(err => {
                    let caleImg = path.join(caleFolderAbsoluta, err.imagine);
                    if (!fs.existsSync(caleImg)) {
                        console.error(`⚠️ EROARE (E): Imaginea '${err.imagine}' NU există pe disc!`);
                    }
                });
            }
        }
    }

    
    if (Array.isArray(dateJson.info_erori)) {
        let idFrecventa = {};
        dateJson.info_erori.forEach(err => {
            if (!idFrecventa[err.identificator]) {
                idFrecventa[err.identificator] = [];
            }
            idFrecventa[err.identificator].push(err);
        });

        for (let id in idFrecventa) {
            if (idFrecventa[id].length > 1) {
                let detaliiErori = idFrecventa[id].map(err => {
                    let copieEroare = { ...err }; 
                    delete copieEroare.identificator; 
                    return JSON.stringify(copieEroare);
                });
                console.error(`⚠️ EROARE (G): Identificatorul HTTP '${id}' apare de mai multe ori!`);
            }
        }
    }
}
// =============================================================
// ETAPA 5: COMPILARE AUTOMATĂ SCSS
// =============================================================

function compileazaScss(caleScss, caleCss) {
    let fisierScssAbsolut = path.isAbsolute(caleScss) ? caleScss : path.join(obGlobal.folderScss, caleScss);
    
    let fisierCssAbsolut;
    if (!caleCss) {
        let numeFisier = path.basename(fisierScssAbsolut, '.scss');
        fisierCssAbsolut = path.join(obGlobal.folderCss, numeFisier + '.css');
    } else {
        fisierCssAbsolut = path.isAbsolute(caleCss) ? caleCss : path.join(obGlobal.folderCss, caleCss);
    }

    if (fs.existsSync(fisierCssAbsolut)) {
        let folderBackupCss = path.join(__dirname, 'backup', 'resurse', 'css');
        if (!fs.existsSync(folderBackupCss)) {
            fs.mkdirSync(folderBackupCss, { recursive: true });
        }
        
        
        let numeBaza = path.basename(fisierCssAbsolut, '.css');
        let timestamp = new Date().getTime(); 
        let caleBackup = path.join(folderBackupCss, `${numeBaza}_${timestamp}.css`);

        try {
            fs.copyFileSync(fisierCssAbsolut, caleBackup);
        } catch (err) {
            console.error("⚠️ EROARE la crearea backup-ului CSS pentru: " + fisierCssAbsolut, err.message);
        }
    }

app.get(['/', '/index', '/home'], (req, res) => {
    const acum = new Date(); 
    const minute = acum.getMinutes();
    
    let sfertCurent = 1;
    if (minute >= 15 && minute < 30) sfertCurent = 2;
    else if (minute >= 30 && minute < 45) sfertCurent = 3;
    else if (minute >= 45 && minute < 60) sfertCurent = 4;

    let imaginiFiltrate = [];
    if (dateGalerie && dateGalerie.imagini) {
        // imaginiFiltrate = dateGalerie.imagini;

         imaginiFiltrate = dateGalerie.imagini.filter(img => img.sfert_ora == sfertCurent);
    }

    imaginiFiltrate = imaginiFiltrate.slice(0, 10);

    console.log("Sfert curent:", sfertCurent);
    console.log("Imagini gasite:", imaginiFiltrate.length);

    res.render('pagini/index', { 
        ip: req.ip, 
        imaginiGalerie: imaginiFiltrate,
        caleBazaGalerie: dateGalerie.cale_galerie
    });
});
    try {
        let rezultatCompilare = sass.compile(fisierScssAbsolut);
        fs.writeFileSync(fisierCssAbsolut, rezultatCompilare.css);
        console.log(`✅ [SASS] Fișier compilat cu succes: ${path.basename(fisierScssAbsolut)} -> ${path.basename(fisierCssAbsolut)}`);
    } catch (err) {
        console.error(`❌ [SASS] EROARE la compilarea SCSS (${fisierScssAbsolut}):`, err.message);
    }
}


function compilareScssInitiala() {
    console.log("⏳ Începem compilarea inițială a fișierelor SCSS...");
    let fisiere = fs.readdirSync(obGlobal.folderScss);
    for (let fisier of fisiere) {
        if (path.extname(fisier) === '.scss') {
            compileazaScss(fisier);
        }
    }
}
compilareScssInitiala();


fs.watch(obGlobal.folderScss, (eventType, filename) => {
    if (filename && filename.endsWith('.scss')) {
        let caleAbsolutaScss = path.join(obGlobal.folderScss, filename);app.get(['/', '/index', '/home'], (req, res) => {
    const acum = new Date(); 
    const minute = acum.getMinutes();
    
    let sfertCurent = 1;
    if (minute >= 15 && minute < 30) sfertCurent = 2;
    else if (minute >= 30 && minute < 45) sfertCurent = 3;
    else if (minute >= 45 && minute < 60) sfertCurent = 4;

    let imaginiFiltrate = [];
    if (dateGalerie && dateGalerie.imagini) {
        //imaginiFiltrate = dateGalerie.imagini;

         imaginiFiltrate = dateGalerie.imagini.filter(img => img.sfert_ora == sfertCurent);
    }

    imaginiFiltrate = imaginiFiltrate.slice(0, 10);

    console.log("Sfert curent:", sfertCurent);
    console.log("Imagini gasite:", imaginiFiltrate.length);

    res.render('pagini/index', { 
        ip: req.ip, 
        imaginiGalerie: imaginiFiltrate,
        caleBazaGalerie: dateGalerie.cale_galerie
    });
});
        if (fs.existsSync(caleAbsolutaScss)) {
            console.log(`🔄 [WATCH] Modificare detectată în '${filename}'. Se recompilează...`);
            compileazaScss(filename);
        }
    }
});


function initErori() {
    verificaEroriJson();
    let continut = fs.readFileSync(path.join(__dirname, 'erori.json'), 'utf-8');
    obGlobal.obErori = JSON.parse(continut);
    
    let erori = obGlobal.obErori.info_erori;
    erori.forEach(eroare => {
        eroare.imagine = path.join(obGlobal.obErori.cale_baza, eroare.imagine);
    });
    obGlobal.obErori.eroare_default.imagine = path.join(obGlobal.obErori.cale_baza, obGlobal.obErori.eroare_default.imagine);
}

initErori();

function afisareEroare(res, identificator, titlu, text, imagine) {
    let eroare = obGlobal.obErori.info_erori.find(e => e.identificator == identificator);
    if (!eroare) {
        let eroareDefault = obGlobal.obErori.eroare_default;
        res.render('pagini/eroare', {
            titlu: titlu || eroareDefault.titlu,
            text: text || eroareDefault.text,
            imagine: imagine || eroareDefault.imagine
        });
        return;
    }
    if (eroare.status) {
        res.status(identificator);
    }
    res.render('pagini/eroare', {
        titlu: titlu || eroare.titlu,
        text: text || eroare.text,
        imagine: imagine || eroare.imagine
    });
}

app.use('/resurse', (req, res, next) => {
    if (req.url.endsWith('/') || !path.extname(req.url)) {
        return afisareEroare(res, 403);
    }
    next();
});

app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse', 'ico', 'favicon.ico'));
});

app.get(/^.*\.ejs$/, (req, res) => {
    afisareEroare(res, 400);
});


app.get(['/', '/index', '/home'], (req, res) => {
    const acum = new Date(); 
    const minute = acum.getMinutes();
    
    let sfertCurent = 1;
    if (minute >= 15 && minute < 30) sfertCurent = 2;
    else if (minute >= 30 && minute < 45) sfertCurent = 3;
    else if (minute >= 45 && minute < 60) sfertCurent = 4;

    let imaginiFiltrate = [];
    if (dateGalerie && dateGalerie.imagini) {
        //imaginiFiltrate = dateGalerie.imagini;

         imaginiFiltrate = dateGalerie.imagini.filter(img => img.sfert_ora == sfertCurent);
    }

    imaginiFiltrate = imaginiFiltrate.slice(0, 10);

    console.log("Sfert curent:", sfertCurent);
    console.log("Imagini gasite:", imaginiFiltrate.length);

    res.render('pagini/index', { 
        ip: req.ip, 
        imaginiGalerie: imaginiFiltrate,
        caleBazaGalerie: dateGalerie.cale_galerie
    });
});
// RUTA PENTRU GALERIA STATICA
app.get(['/galerie-statica', '/galerie-statica.html'], (req, res) => {
    const minute = new Date().getMinutes();
    
    let sfertCurent = 1;
    if (minute >= 15 && minute < 30) sfertCurent = 2;
    else if (minute >= 30 && minute < 45) sfertCurent = 3;
    else if (minute >= 45 && minute < 60) sfertCurent = 4;

    let imaginiFiltrate = [];
    if (dateGalerie && dateGalerie.imagini) {
        imaginiFiltrate = dateGalerie.imagini.filter(img => img.sfert_ora == sfertCurent);
    }
    imaginiFiltrate = imaginiFiltrate.slice(0, 10);

    res.render('pagini/galerie-statica', {
        imaginiGalerie:  imaginiFiltrate,
        caleBazaGalerie: dateGalerie.cale_galerie
    });
});

// RUTA PENTRU GALERIA DINAMICA (ANIMATA) - CERINȚA CUSTOM 14

app.get(['/galerie-dinamica', '/galerie-dinamica.html'], (req, res) => {
    const posibilitati = [6, 8, 10, 12, 14];
    const nrImagini = posibilitati[Math.floor(Math.random() * posibilitati.length)];

    
    let imaginiImpare = [];
    if (dateGalerie && dateGalerie.imagini) {
        imaginiImpare = dateGalerie.imagini.filter((img, index) => index % 2 !== 0);
    }

    
    let mapDistincte = new Map();
    for(let img of imaginiImpare) {
        let cale = img.cale_imagine || img.fisier || img.src;
        if(!mapDistincte.has(cale)) {
            mapDistincte.set(cale, img);
        }
    }
    let imaginiUnice = Array.from(mapDistincte.values());


    let imaginiAlese = imaginiUnice.slice(0, nrImagini);
    let nAfectiv = imaginiAlese.length;
    if (nAfectiv === 0) nAfectiv = 1; 

    
    let sassString = `
        $n: ${nAfectiv};
        $timp-cadru: 3s; 
        $timp-tranzitie: 1.5s;
        $timp-total: $n * ($timp-cadru + $timp-tranzitie);
        $p-total: 100 / $n;
        $p-hold: $p-total * ($timp-cadru / ($timp-cadru + $timp-tranzitie));
        $p-shrink: $p-total - $p-hold;

        .galerie-animata-css {
            width: 700px;
            max-width: 90%;
            height: 450px;
            margin: 50px auto;
            position: relative;
            
            border: 8px solid transparent;
            /* Border image conform cerintei */
            border-image: url('/resurse/imagini/sala-mare.jpg') 20% round; 
            
            overflow: hidden;
            box-shadow: 0 10px 20px rgba(0,0,0,0.4);

            
            &:hover figure {
                animation-play-state: paused;
            }

        
            @media (max-width: 900px) {
                display: none;
            }

            figure {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                margin: 0;
                
                animation-name: animatie-clip-path;
                animation-duration: $timp-total;
                animation-iteration-count: infinite;
                animation-timing-function: linear;
                animation-fill-mode: both;

                img {
                    width: 100%; height: 100%; object-fit: cover; display: block;
                }
                
                figcaption {
                    position: absolute;
                    bottom: 0; width: 100%;
                    background: rgba(255,255,255,0.9);
                    color: black; text-align: center;
                    padding: 10px; font-weight: bold; font-family: sans-serif;
                }
            }

            
            @for $i from 1 through $n {
                figure:nth-child(#{$i}) {
                    animation-delay: -($n - $i + 1) * ($timp-cadru + $timp-tranzitie);
                }
            }
        }

        @keyframes animatie-clip-path {
            0% {
                clip-path: polygon(0% 0%, 100% 0%, 0% 100%, 0% 0%, 100% 100%, 100% 0%, 0% 100%, 100% 100%);
                z-index: 10; opacity: 1;
            }
            #{$p-hold}% {
                /* Stă pe ecran neatinsă */
                clip-path: polygon(0% 0%, 100% 0%, 0% 100%, 0% 0%, 100% 100%, 100% 0%, 0% 100%, 100% 100%);
                z-index: 10; opacity: 1;
            }
            #{$p-total}% {
                
                clip-path: polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%, 100% 100%, 100% 100%, 100% 100%, 100% 100%);
                z-index: 10; opacity: 1;
            }
            #{$p-total + 0.001}% {
                /* După ce devine invizibilă, o trecem sub restul */
                z-index: -1; opacity: 0;
                clip-path: polygon(0% 0%, 100% 0%, 0% 100%, 0% 0%, 100% 100%, 100% 0%, 0% 100%, 100% 100%);
            }
            #{100 - $p-shrink}% {
                z-index: -1; opacity: 0;
            }
            #{100 - $p-shrink + 0.001}% {
                /* O pregătim să fie poza de fundal care se dezvăluie */
                z-index: 5; opacity: 1;
            }
            100% {
                z-index: 5; opacity: 1;
            }
        }
    `;

    // 6. Compilăm string-ul SASS în CSS
    let cssGenerat = "";
    try {
        let rezultat = sass.compileString(sassString);
        cssGenerat = rezultat.css;
    } catch (err) {
        console.error("Eroare la compilarea SASS pentru galerie:", err);
    }

    res.render('pagini/galerie-dinamica', {
        imaginiGalerie: imaginiAlese,
        caleBazaGalerie: dateGalerie.cale_galerie,
        cssDinamic: cssGenerat,
        nrImagini: nAfectiv
    });
});

// Ruta pentru pagina de produse (Etapa 6 + BONUS 1)
app.get(['/produse', '/produse.html'], (req, res) => {
    
    // --- ADĂUGARE PENTRU CERINȚA 4 (Filtrare server-side) ---
    // 1. Preluăm parametrul "categorie" din URL (dacă există)
    let tipCategorie = req.query.categorie; 
    
    // 2. Presupunem inițial că trimitem toate produsele
    let produseFiltrate = dateProduse; 

    // 3. Dacă utilizatorul a dat click pe o categorie specifică (și nu pe "toate")
    if (tipCategorie && tipCategorie !== 'toate') {
        // Filtrăm array-ul la nivel de server!
        produseFiltrate = dateProduse.filter(p => p.categorie === tipCategorie);
    }
    // ---------------------------------------------------------

    // BONUS 1: Extragem date dinamice pentru a construi filtrele
    let minPret = dateProduse.length > 0 ? Math.min(...dateProduse.map(p => p.pret)) : 0;
    let maxPret = dateProduse.length > 0 ? Math.max(...dateProduse.map(p => p.pret)) : 100;
    let saliUnice = [...new Set(dateProduse.map(p => p.sala))];
    let dificultatiUnice = [...new Set(dateProduse.map(p => p.nivel_dificultate))];
    
    let echipamenteUnice = [];
    dateProduse.forEach(p => {
        if (p.echipament) echipamenteUnice = echipamenteUnice.concat(p.echipament);
    });
    echipamenteUnice = [...new Set(echipamenteUnice)]; 

    // 4. La final, trimitem către EJS doar array-ul FILTRAT
    res.render('pagini/produse', { 
        produse: produseFiltrate,  
        minPret: minPret,
        maxPret: maxPret,
        saliUnice: saliUnice,
        dificultatiUnice: dificultatiUnice,
        echipamenteUnice: echipamenteUnice
    });
});
// Ruta pentru o singură pagină de produs (Cerința 15.2 - Pagină produs unic)
app.get('/produs/:id', (req, res) => {
    let idCerut = parseInt(req.params.id);
    
    // Căutăm produsul în array-ul nostru
    let produsGasit = dateProduse.find(p => p.id === idCerut);
    
    if (!produsGasit) {
        // Dacă cineva bagă un ID care nu există, îi dăm eroare 404
        return afisareEroare(res, 404, "Produs Negăsit", "Clasa de fitness pe care o cauți nu există.");
    }

    // Trimitem datele produsului către șablonul EJS
    res.render('pagini/produs', { 
        produs: produsGasit 
    });
});
// =================================================================
// BONUS 12: SISTEM DE OFERTE (Generare automată)
// =================================================================
const caleOferte = path.join(__dirname, 'oferte.json');
let dateOferte = { oferte: [] };

if (!fs.existsSync(caleOferte)) {
    fs.writeFileSync(caleOferte, JSON.stringify(dateOferte));
} else {
    try { dateOferte = JSON.parse(fs.readFileSync(caleOferte, 'utf-8')); } catch(e) {}
}

function genereazaOferta() {
    if (!dateProduse || dateProduse.length === 0) return;
    
    let categorii = [...new Set(dateProduse.map(p => p.categorie))];
    let reduceri = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    
    // a. Nu se vor genera două oferte consecutive pt aceeași categorie
    let ultimaCat = dateOferte.oferte.length > 0 ? dateOferte.oferte[0].categorie : "";
    let catDisponibile = categorii.filter(c => c !== ultimaCat);
    if (catDisponibile.length === 0) catDisponibile = categorii; 
    
    let catAlesa = catDisponibile[Math.floor(Math.random() * catDisponibile.length)];
    let redAlesa = reduceri[Math.floor(Math.random() * reduceri.length)];
    
    // a. Setăm T = 60 de secunde (pentru testare rapidă la prezentare)
    let T = 5 * 60 * 1000; 
    let dataStart = new Date();
    let dataFinal = new Date(dataStart.getTime() + T);

    let ofertaNoua = {
        categorie: catAlesa,
        reducere: redAlesa,
        "data-incepere": dataStart.toISOString(),
        "data-finalizare": dataFinal.toISOString()
    };

    dateOferte.oferte.unshift(ofertaNoua); // Punem oferta pe prima poziție

    // e. Ștergem ofertele care au expirat de mai mult de T2 (T2 = 2 minute)
    let T2 = 10 * 60 * 1000; 
    let acum = new Date().getTime();
    dateOferte.oferte = dateOferte.oferte.filter(o => {
        return (acum - new Date(o["data-finalizare"]).getTime()) < T2;
    });

    fs.writeFileSync(caleOferte, JSON.stringify(dateOferte, null, 2));
}

// Generăm o ofertă instant și apoi rulăm ciclul o dată pe minut
genereazaOferta();
setInterval(genereazaOferta,  5 * 60 * 1000); 

// Creăm o mini-rută (API) de unde frontend-ul să "fure" oferta
app.get('/api/oferta', (req, res) => {
    res.json(dateOferte.oferte.length > 0 ? dateOferte.oferte[0] : null);
});
app.get(/^.*$/, (req, res) => {
    // Tăiem automat extensia .html din link ca serverul să caute corect fișierul .ejs
    let calePagina = req.url;
    if (calePagina.endsWith('.html')) {
        calePagina = calePagina.slice(0, -5); 
    }

    res.render('pagini' + calePagina, function(err, rezultatRandare) {
        if (err) {
            if (err.message.startsWith('Failed to lookup view')) {
                afisareEroare(res, 404);
            } else {
                afisareEroare(res); 
            }
        } else {
            res.send(rezultatRandare);
        }
    });
});

app.listen(port, () => {
    console.log("-----------------------------------------");
    console.log("Calea folderului (__dirname):", __dirname);
    console.log(`Serverul rulează la adresa http://localhost:${port}`);
});