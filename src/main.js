import "./style.css";
import { auth, db, rtdb, storage, isConfigured } from "./firebase.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  collection, getDocs, addDoc, doc, deleteDoc, setDoc
} from "firebase/firestore";
import { ref, get, set } from "firebase/database";
import {
  ref as storageRef, uploadBytes, listAll, getDownloadURL, deleteObject
} from "firebase/storage";

const app = document.querySelector("#app");
let currentUser = null;
let activePage = "Overview";

const icon = (name) => ({
  Overview:"▦", Firestore:"◫", Realtime:"⌁", Storage:"▤", "Project setup":"⚙"
}[name] || "•");

function render() {
  if (!isConfigured) {
    app.innerHTML = `
      <main class="setup-screen">
        <div class="setup-card">
          <div class="brand-mark">M</div>
          <p class="eyebrow">FIREBASE ADMIN WORKSPACE</p>
          <h1>MUTTHI <span>PANEL</span></h1>
          <p class="muted">Your Firebase workspace is ready to configure.</p>
          <div class="notice"><b>Firebase configuration needed</b><br>
            Open <code>src/firebase.js</code> and replace the sample values with your Firebase Web App configuration.
          </div>
          <ol>
            <li>Open Firebase Console and select your project.</li>
            <li>Go to Project settings → Your apps → Web app.</li>
            <li>Copy the Firebase config into <code>src/firebase.js</code>.</li>
            <li>Enable Email/Password in Authentication and create your database services.</li>
          </ol>
          <p class="small muted">Never put a service-account JSON file or private key in this frontend.</p>
        </div>
      </main>`;
    return;
  }

  if (!currentUser) {
    app.innerHTML = `
      <main class="login-wrap">
        <section class="login-card">
          <div class="brand-mark">M</div><p class="eyebrow">FIREBASE ADMIN WORKSPACE</p>
          <h1>MUTTHI <span>PANEL</span></h1>
          <p class="muted">Sign in with an authorized Firebase account.</p>
          <form id="login-form">
            <label>Email address<input name="email" type="email" placeholder="admin@example.com" required></label>
            <label>Password<input name="password" type="password" placeholder="Your password" required></label>
            <button class="primary full" type="submit">Sign in</button>
          </form>
          <p class="small muted">New account creation should be restricted to your approved administrators. Use Firebase Console to create admin accounts.</p>
          <p id="login-error" class="error"></p>
        </section>
      </main>`;
    document.querySelector("#login-form").addEventListener("submit", async e => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      try {
        await signInWithEmailAndPassword(auth, data.get("email"), data.get("password"));
      } catch (err) { document.querySelector("#login-error").textContent = friendly(err); }
    });
    return;
  }

  const pages = ["Overview", "Firestore", "Realtime", "Storage", "Project setup"];
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark smallmark">M</div><div><b>MUTTHI</b><span>PANEL</span></div></div>
        <div class="side-label">WORKSPACE</div>
        <nav>${pages.map(p=>`<button class="nav-item ${activePage===p?"active":""}" data-page="${p}"><i>${icon(p)}</i>${p}</button>`).join("")}</nav>
        <div class="sidebar-bottom"><div class="status-dot"></div><span>Firebase connected</span></div>
      </aside>
      <section class="main-area">
        <header class="topbar"><div><span class="eyebrow">ADMIN CONSOLE</span><h2>${activePage}</h2></div>
          <div class="user-area"><span class="user-email">${escapeHtml(currentUser.email || "Admin")}</span><button id="logout" class="outline">Sign out</button></div>
        </header>
        <main class="content" id="page-content"></main>
      </section>
    </div>`;
  document.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click",()=>{activePage=b.dataset.page;render();}));
  document.querySelector("#logout").addEventListener("click",()=>signOut(auth));
  renderPage();
}

function renderPage() {
  const target = document.querySelector("#page-content");
  if (activePage === "Overview") {
    target.innerHTML = `
      <div class="welcome"><div><p class="eyebrow">CONTROL CENTER</p><h1>Welcome back, Admin.</h1><p class="muted">Manage your connected Firebase services from one place.</p></div><div class="welcome-icon">✦</div></div>
      <div class="stats">
        <article class="stat-card"><span>AUTHENTICATION</span><strong>Connected</strong><small>Email/password sign-in</small></article>
        <article class="stat-card"><span>CLOUD FIRESTORE</span><strong>Ready</strong><small>Access depends on your rules</small></article>
        <article class="stat-card"><span>REALTIME DATABASE</span><strong>Ready</strong><small>Access depends on your rules</small></article>
        <article class="stat-card"><span>CLOUD STORAGE</span><strong>Ready</strong><small>Access depends on your rules</small></article>
      </div>
      <div class="panel"><div class="panel-head"><div><p class="eyebrow">QUICK ACCESS</p><h3>Firebase services</h3></div></div>
      <div class="quick-grid">${["Firestore","Realtime","Storage","Project setup"].map(p=>`<button class="quick" data-page="${p}"><b>${icon(p)}</b><span>${p}</span><small>Open manager →</small></button>`).join("")}</div></div>
      <div class="notice"><b>Security reminder</b><br>This panel uses the Firebase Web SDK. It does not bypass Firestore, Realtime Database, or Storage security rules. Do not make your database public to make the panel work.</div>`;
    target.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{activePage=b.dataset.page;render();}));
  } else if (activePage === "Firestore") renderFirestore(target);
  else if (activePage === "Realtime") renderRealtime(target);
  else if (activePage === "Storage") renderStorage(target);
  else target.innerHTML = `
    <div class="panel"><p class="eyebrow">PROJECT CONFIGURATION</p><h3>Connected Firebase project</h3>
      <p class="muted">Configuration is stored in <code>src/firebase.js</code>. Update it there, then rebuild and redeploy.</p>
      <div class="notice">The Firebase Web API key identifies your project; it is not an admin secret. Protect data with Authentication, security rules, and App Check where appropriate.</div>
      <h3>Enable these Firebase services</h3><ul class="service-list"><li>Authentication → Email/Password</li><li>Cloud Firestore</li><li>Realtime Database (if needed)</li><li>Cloud Storage (if needed)</li></ul>
    </div>`;
}

async function renderFirestore(target) {
  target.innerHTML = `<div class="panel"><p class="eyebrow">CLOUD FIRESTORE</p><h3>Collection browser</h3>
    <form id="fs-load" class="inline-form"><input name="collection" placeholder="Collection name (e.g. products)" required><button class="primary">Load collection</button></form>
    <div id="fs-results" class="results muted">Enter a collection name to load its documents.</div>
    <hr><h3>Add document</h3><form id="fs-add" class="stack-form">
      <input name="collection" placeholder="Collection name" required>
      <input name="docid" placeholder="Document ID (optional)">
      <textarea name="json" rows="5" placeholder='{"name":"Example","active":true}' required></textarea>
      <button class="primary">Add document</button></form><p id="fs-msg" class="small"></p></div>`;
  const results = target.querySelector("#fs-results"), msg=target.querySelector("#fs-msg");
  target.querySelector("#fs-load").onsubmit = async e => {
    e.preventDefault(); const name=new FormData(e.currentTarget).get("collection");
    results.textContent="Loading…";
    try {
      const snap=await getDocs(collection(db,name));
      if(snap.empty){results.textContent="No documents found.";return;}
      results.innerHTML=snap.docs.map(d=>`<div class="doc-row"><div><b>${escapeHtml(d.id)}</b><pre>${escapeHtml(JSON.stringify(d.data(),null,2))}</pre></div><button class="danger" data-delete="${escapeHtml(d.id)}" data-collection="${escapeHtml(name)}">Delete</button></div>`).join("");
      results.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(confirm("Delete this document?")){await deleteDoc(doc(db,b.dataset.collection,b.dataset.delete));e.currentTarget.requestSubmit();}});
    } catch(err){results.textContent=friendly(err);}
  };
  target.querySelector("#fs-add").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    try{const data=JSON.parse(f.get("json"));const col=f.get("collection"),id=f.get("docid").trim();
      if(id) await setDoc(doc(db,col,id),data); else await addDoc(collection(db,col),data);
      msg.textContent="Document saved.";msg.className="small success";e.currentTarget.reset();
    }catch(err){msg.textContent=err instanceof SyntaxError?"Invalid JSON.":friendly(err);msg.className="small error";}
  };
}

async function renderRealtime(target) {
  target.innerHTML=`<div class="panel"><p class="eyebrow">REALTIME DATABASE</p><h3>Read or write a path</h3>
    <form id="rt-form" class="stack-form"><input name="path" value="/" placeholder="Database path, e.g. /settings" required>
    <textarea name="value" rows="6" placeholder="JSON value for write"></textarea>
    <div class="button-row"><button class="outline" type="button" id="rt-read">Read path</button><button class="primary" type="submit">Write JSON</button></div></form>
    <pre id="rt-result" class="code-output">Result will appear here.</pre><p id="rt-msg" class="small"></p></div>`;
  const form=target.querySelector("#rt-form"),out=target.querySelector("#rt-result"),msg=target.querySelector("#rt-msg");
  target.querySelector("#rt-read").onclick=async()=>{try{const path=form.path.value;const s=await get(ref(rtdb,path));out.textContent=JSON.stringify(s.val(),null,2);}catch(err){out.textContent=friendly(err);}};
  form.onsubmit=async e=>{e.preventDefault();try{await set(ref(rtdb,form.path.value),JSON.parse(form.value.value));msg.textContent="Value written.";msg.className="small success";}catch(err){msg.textContent=err instanceof SyntaxError?"Enter valid JSON.":friendly(err);msg.className="small error";}};
}

async function renderStorage(target) {
  target.innerHTML=`<div class="panel"><p class="eyebrow">CLOUD STORAGE</p><h3>Upload a file</h3>
    <form id="upload-form" class="inline-form"><input type="file" name="file" required><input name="folder" placeholder="Folder (optional)"><button class="primary">Upload</button></form>
    <p id="storage-msg" class="small"></p><hr><div class="panel-head"><h3>Files in bucket</h3><button class="outline" id="refresh-files">Refresh</button></div><div id="file-list" class="results muted">Loading files…</div></div>`;
  const list=target.querySelector("#file-list"),msg=target.querySelector("#storage-msg");
  async function refresh(){list.textContent="Loading…";try{const items=await listAll(storageRef(storage,""));if(!items.items.length&&!items.prefixes.length){list.textContent="No files found.";return;}
    list.innerHTML=items.items.map(item=>`<div class="file-row"><span>▤ ${escapeHtml(item.name)}</span><button class="outline" data-url="${escapeHtml(item.fullPath)}">Get link</button><button class="danger" data-del="${escapeHtml(item.fullPath)}">Delete</button></div>`).join("");
    list.querySelectorAll("[data-url]").forEach(b=>b.onclick=async()=>{try{const url=await getDownloadURL(storageRef(storage,b.dataset.url));window.prompt("File download URL",url);}catch(err){alert(friendly(err));}});
    list.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(confirm("Delete this file?")){try{await deleteObject(storageRef(storage,b.dataset.del));refresh();}catch(err){alert(friendly(err));}}});
  }catch(err){list.textContent=friendly(err);}}
  target.querySelector("#refresh-files").onclick=refresh;
  target.querySelector("#upload-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),file=f.get("file"),folder=f.get("folder").trim();try{await uploadBytes(storageRef(storage,[folder,file.name].filter(Boolean).join("/")),file);msg.textContent="Upload complete.";msg.className="small success";e.currentTarget.reset();refresh();}catch(err){msg.textContent=friendly(err);msg.className="small error";}};
  refresh();
}

function friendly(err){return err?.code ? `${err.code}: ${err.message}` : (err?.message || "Something went wrong.");}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
onAuthStateChanged(auth,user=>{currentUser=user;render();});
