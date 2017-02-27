# AnonChat
Completed features:
  Can either joing the global chat room or create a new chat room by adding ?room=roomName to
  the end of your URL
  Chat Commands:
    /mute - to mute not so nice people
    /colors - choose a new color
    /remember - to keep your username if you really like it
    /forget - if you wanted to remember you username but now you don't
    /room - sends a message to everybody in the current room with a hyperlink to a new chat
    
    chat commands will give suggestions and autocomplete when right arrow key is pressed
  
  Clicking another user's username will populate the text field with it
  Shift + clicking one will toggle a highlight on all the messages from that user
  
  Messages older than 100 newer messages will be removed
  
  Amount of current users is displayed in top right
  
  If a user is still in the chat room any mentions of their username (@username) will be
  blue, but when they leave it will turn black
  It will also turn back blue if they return with the same username 
  
TODO features:
  Add whisper chat command so users can privately send messages
  Delete old messages from users that you've muted
  Implement some form of rate limiting with a Captcha 
