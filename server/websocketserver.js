const WebSocket = require("ws");
const redis = require("redis");
let publisher;
let redisClient;

let clients = [];

// Intiiate the websocket server
const initializeWebsocketServer = async (server) => {
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || "6379",
    },
  });
  await redisClient.connect();
  // This is the subscriber part
  const subscriber = redisClient.duplicate();
  await subscriber.connect();
  // This is the publisher part
  publisher = redisClient.duplicate();
  await publisher.connect();

  const websocketServer = new WebSocket.Server({ server });
  websocketServer.on("connection", onConnection);
  websocketServer.on("error", console.error);
  await subscriber.subscribe("newMessage", onRedisMessage);
  redisClient.del("users");
};

// If a new connection is established, the onConnection function is called
const onConnection = (ws) => {
  console.log("New websocket connection");
  ws.on("close", () => onClose(ws));
  ws.on("message", (message) => onClientMessage(ws, message));
};

const getUsersFromRedis = async () => {
  let users = await redisClient.get("users");
  if (users) {
    users = JSON.parse(users);
  } else {
    users = [];
  }
  return users;
};

// If a new message is received, the onClientMessage function is called
const onClientMessage = async (ws, message) => {
  const messageObject = JSON.parse(message);
  console.log("Received message from client: " + messageObject.type);
  switch (messageObject.type) {
    case "user":
      clients = clients.filter((client) => client.ws !== ws);
      clients.push({ ws, user: messageObject.user });
      console.log("Number of clients: " + clients.length)
      let users = await getUsersFromRedis();
      users = users.filter((user) => user.id !== messageObject.user.id);
      users.push(messageObject.user);
      redisClient.set("users", JSON.stringify(users));
      const message = {
        type: "pushUsers",
      };
      publisher.publish("newMessage", JSON.stringify(message));
      break;
    case "message":
      publisher.publish("newMessage", JSON.stringify(messageObject));
      break;
    default:
      console.error("Unknown message type: " + messageObject.type);
  }
};

// If a new message from the redis channel is received, the onRedisMessage function is called
const onRedisMessage = async (message) => {
  const messageObject = JSON.parse(message);
  console.log("Received message from redis channel: " + messageObject.type);
  switch (messageObject.type) {
    case "message":
      clients.forEach((client) => {
        client.ws.send(JSON.stringify(messageObject));
      });
      break;
    case "pushUsers":
      const users = await getUsersFromRedis();
      const message = {
        type: "users",
        users,
      };
      clients.forEach((client) => {
        client.ws.send(JSON.stringify(message));
      });
      break;
    default:
      console.error("Unknown message type: " + messageObject.type);
  }
};

// If a connection is closed, the onClose function is called
const onClose = async (ws) => {
  console.log("Websocket connection closed");
  const client = clients.find((client) => client.ws === ws);
  let users = await getUsersFromRedis();
  if (client) {
    users = users.filter((user) => user.id !== client.user.id);
  }
  redisClient.set("users", JSON.stringify(users));
  const message = {
    type: "pushUsers",
  };
  publisher.publish("newMessage", JSON.stringify(message));
  clients = clients.filter((client) => client.ws !== ws);
};

module.exports = { initializeWebsocketServer };
