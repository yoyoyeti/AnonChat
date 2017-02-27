// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';

var maxMessageLength = 140;
// Port where we'll run the websocket server
var webSocketsServerPort = 1337;

// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
var url = require("url");
var fs   = require('fs');
// var colors = [ '#c26e67', '#a96379', '#866a84', '#d09898', '#ed7575', '#a64e9d', '#56a0d3', '#daaaad', '#44537e'];
var rooms = [ ];

var server = http.createServer(function(request, response) {});

server.listen(webSocketsServerPort, function() {
    console.log(" Server is listening on port " + webSocketsServerPort);
});

var wsServer = new webSocketServer({
    httpServer: server
});

/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getRoomByID(roomID){
  for(var i=0; i < rooms.length; i++){
    if(rooms[i].roomID == roomID){
      console.log("Joining room: " + roomID + " because it already existed.");
      return rooms[i];
    }
  }
  console.log("Creating new room: " + roomID + " because it didn't exist.");
  return newRoom(roomID);
}

function newRoom(roomID){
  var room = new Object();
  room.clients = [ ];
  room.clientIDs = [ ];
  room.history = [ ];
  room.roomID = roomID;
  rooms.push(room);

  console.log("creating room " + room.roomID)
  return room;
}



// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log(' Connection from origin ' + request.origin + '.');

    var connection = request.accept(null, request.origin);
    var client = new Object();
    var room = null;

    connection.on('message', function(message) {
        try {
            var json = JSON.parse(message.utf8Data);
        } catch (e) {
            console.log('This doesn\'t look like valid JSON: ', message.utf8Data);
            return;
        }

        switch (json.type) {
          case "message":
              if(json.text.length <= maxMessageLength){
                console.log(' Received Message from ' + client.userName + ': ' + json.text);
                sendToAll("message", { text: htmlEntities(json.text), author: client.userName, color: client.color }, true);
              }
              break;
          case "connection":
              console.log("Attempting to join room " + json.room);
              room = getRoomByID(json.room);

              client.userName = json.name;
              client.color = json.color;
              client.connection = connection;
              room.clients.push(client);
              room.clientIDs.push(client.userName);

              console.log("Sending new user info to all clients currently connected");
              sendToAll("userConnect", { userName: json.name, userCount: room.clients.length}, false);

              console.log("sending usernames to new user");
              connection.sendUTF(JSON.stringify({type: "allClients", data: room.clientIDs}));

              console.log(' User is known as: ' + client.userName + 'with color: ' + client.color);

              connection.sendUTF(JSON.stringify( { type: 'history', data: room.history} ));

              break;
          case "color":
              client.color = json.color;
              break;
          default:
            console.log("Message type not recognized");
        }
    });

    // user disconnected
    connection.on('close', function(connection) {
        if (client.userName !== false) {
            console.log(" Peer " + client.userName + " disconnected.");

            console.log("removing " + client.userName + " from clientIDs");
            room.clientIDs.splice(room.clientIDs.indexOf(client.userName), 1);

            sendToAll("userDisconnect", { userName: client.userName, userCount: room.clients.length - 1}, false);

            var i = 0;
            while(room.clients[i].connection != client.connection){
              i++;
            }
            console.log(" removing user " + room.clients[i].userName);
            room.clients.splice(i, 1);

            if(room.clients.length === 0){
              i = 0;
              while(rooms[i].roomID != room.roomID){
                i++;
              }
              console.log("removing room " + room.roomID);
              rooms.splice(i, 1);
            }
        }
    });

    function sendToAll(messageType, message, pushToHistory){
      var json = JSON.stringify({ type:messageType, data:message });

      if(pushToHistory){
        room.history.push(json);
        room.history = room.history.slice(-100);
      }

      for (var i=0; i < room.clients.length; i++) {
          room.clients[i].connection.sendUTF(json);
      }
    }
});
