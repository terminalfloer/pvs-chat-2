if (location.host.includes("localhost")) {
  // Load livereload script if we are on localhost
  document.write(
    '<script src="http://' +
      (location.host || "localhost").split(":")[0] +
      ':35729/livereload.js?snipver=1"></' +
      "script>"
  );
}

function guidGenerator() {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (
    S4() +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    S4() +
    S4()
  );
}

const backendUrl = window.location.origin.replace(/^http/, "ws");
const socket = new WebSocket(backendUrl);

const userId = guidGenerator();

async function getRandomUser() {
  const response = await fetch("https://randomuser.me/api/");
  const data = await response.json();
  return data.results[0];
}

socket.addEventListener("open", async (event) => {
  console.log("WebSocket connected!");
  const user = await getRandomUser();
  document.getElementById("username").value = user.name.first;
  const message = {
    type: "user",
    user: {
      id: userId,
      name: document.getElementById("username").value,
    },
  };
  socket.send(JSON.stringify(message));
});

socket.addEventListener("message", (event) => {
  const messageObject = JSON.parse(event.data);
  console.log("Received message from server: " + messageObject.type);
  switch (messageObject.type) {
    case "users":
      showUsers(messageObject.users);
      break;
    case "message":
      showMessage(messageObject.message);
      break;
    default:
      console.error("Unknown message type: " + messageObject.type);
  }
});

function showUsers(users) {
  const usersElement = document.getElementById("users");
  usersElement.innerHTML = "";
  users.forEach((user) => {
    const userElement = document.createElement("div");
    userElement.innerHTML = user.name;
    usersElement.appendChild(userElement);
  });
}

function showMessage(message) {
  const messageElement = document.createElement("div");
  const innerMessageElement = document.createElement("div");
  const userElement = document.createElement("span");
  const messageTextElement = document.createElement("p");
  innerMessageElement.classList.add(
    "rounded-lg",
    "p-4",
    "inline-flex",
    "flex-col",
    "gap-2"
  );
  userElement.classList.add("font-bold");
  if (message.user.id === userId) {
    messageElement.classList.add("text-right", "self-end");
    innerMessageElement.classList.add("bg-green-500");
  } else {
    innerMessageElement.classList.add("bg-slate-500");
  }
  userElement.innerHTML = message.user.name + " at " + message.time;
  messageTextElement.innerHTML = message.message;
  innerMessageElement.appendChild(userElement);
  innerMessageElement.appendChild(messageTextElement);
  messageElement.appendChild(innerMessageElement);
  document.getElementById("messages").appendChild(messageElement);
}

socket.addEventListener("close", (event) => {
  console.log("WebSocket closed.");
});

socket.addEventListener("error", (event) => {
  console.error("WebSocket error:", event);
});

function changeUsername() {
  const newUsername = document.getElementById("username").value;
  if (newUsername === "") return;
  const message = {
    type: "user",
    user: {
      id: userId,
      name: document.getElementById("username").value,
    },
  };
  socket.send(JSON.stringify(message));
}

function sendMessage() {
  const messageText = document.getElementById("message").value;
  if (messageText === "") return;
  const message = {
    type: "message",
    message: {
      user: {
        id: userId,
        name: document.getElementById("username").value,
      },
      message: messageText,
      time: new Date().toLocaleTimeString(),
    },
  };
  socket.send(JSON.stringify(message));
  document.getElementById("message").value = "";
}
