<!DOCTYPE html>
<html lang="hr">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>AI turistički informator – Biograd na Moru</title>

<style>

body{
margin:0;
font-family:Arial;
background:#0f3b63;
}

header{
background:#0c2f4f;
color:white;
padding:20px;
font-size:22px;
font-weight:bold;
}

.menu{
background:#1e5b92;
padding:10px;
display:flex;
gap:10px;
justify-content:center;
flex-wrap:wrap;
}

.menu button{
background:#2f74b3;
color:white;
border:none;
padding:10px 14px;
border-radius:8px;
cursor:pointer;
font-size:14px;
}

.menu button:hover{
background:#3d86c9;
}

.chat-container{
max-width:900px;
margin:20px auto;
background:white;
border-radius:12px;
padding:20px;
height:500px;
overflow-y:auto;
}

.bot-message{
background:#f3f7fb;
padding:14px;
border-radius:10px;
margin-bottom:12px;
}

.user-message{
text-align:right;
margin-bottom:12px;
}

.input-area{
max-width:900px;
margin:10px auto;
display:flex;
gap:10px;
}

input{
flex:1;
padding:12px;
border-radius:8px;
border:1px solid #ccc;
}

button.send{
background:#2f74b3;
color:white;
border:none;
padding:12px 16px;
border-radius:8px;
cursor:pointer;
}

</style>

</head>

<body>

<header>

AI turistički informator – Biograd na Moru

</header>

<div class="menu">

<button onclick="quick('plaže')">🏖 Plaže</button>
<button onclick="quick('marina')">⛵ Marina</button>
<button onclick="quick('restoran')">🍽 Gastronomija</button>
<button onclick="quick('znamenitosti')">🏛 Znamenitosti</button>
<button onclick="quick('događanja')">🎉 Događanja</button>
<button onclick="quick('smještaj')">🏨 Smještaj</button>

</div>

<div id="chat" class="chat-container">

<div class="bot-message">

👋 Pozdrav!  
Ja sam AI turistički informator Biograda na Moru.  
Kako vam mogu pomoći?

</div>

</div>

<div class="input-area">

<input id="question" placeholder="Postavite pitanje...">

<button class="send" onclick="send()">Pošalji</button>

</div>

<script>

function addMessage(text, sender){

const chat = document.getElementById("chat");

const msg = document.createElement("div");

if(sender==="user"){

msg.className="user-message";
msg.textContent=text;

}else{

msg.className="bot-message";
msg.innerHTML=text;

}

chat.appendChild(msg);

chat.scrollTop=chat.scrollHeight;

}

async function send(){

const input=document.getElementById("question");

const text=input.value;

if(!text) return;

addMessage(text,"user");

input.value="";

try{

const res=await fetch("/api/chat",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

conversation:[
{role:"user",content:text}
]

})

});

const data=await res.json();

addMessage(data.reply,"bot");

}catch(e){

addMessage("Greška u komunikaciji sa serverom.","bot");

}

}

function quick(text){

addMessage(text,"user");

fetch("/api/chat",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

conversation:[
{role:"user",content:text}
]

})

})

.then(r=>r.json())

.then(data=>{

addMessage(data.reply,"bot");

});

}

</script>

</body>

</html>
