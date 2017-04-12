String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

$(function () {
    "use strict";

    /**
     * Variables
     */
    var content = $('#wrapper');
    var input = $('#input');
    var more = $('#more');
    var userCounter = $('#currentUsers');
    var characterLimit = $('#characterLimit');
    var garbage = $('#garbage');
    var suggestion = $('#suggestion');
    var scrollObj = document.getElementById("wrapper");
    var users = [ ];
    var muteList = [ ];
    var myName = false;
    var myColor = false;
    var backgroundColorCounter = 0;
    var messagesSent = 0;
    var captchaVerified = false;
    var initialized = false;
    var connection;
    const MAXMESSAGES = 5;
    const COLORS = [ "#c26e67", "#a96379", "#866a84", "#d09898", "#ed7575", "#a64e9d", "#56a0d3", "#daaaad", "#44537e"];
    const BACKGROUND_COLORS = ["rgba(217, 140, 63, 0.42)", "rgba(35, 193, 193, 0.2)", "rgba(109, 109, 217, 0.3)", "rgba(145, 180, 163, 0.3)", "rgba(220, 54, 54, 0.38)"];
    const VALID_COMMANDS = ["/help", "/mute", "/room", "/remember", "/forget", "/colors", "/whisper"];

    /**
     * Rate Limiting and Captcha stuff
     */
     //Resets the amount of messages a user can send every 30 seconds
    setInterval(function() {
        messagesSent = 0;
    }, 30000);

    /**
     * Connection Stuff
     */
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    if (!window.WebSocket) {
        content.html($('<p>', { text: 'Sorry, but your browser doesn\'t support WebSockets.'} ));
        input.hide();
        $('span').hide();
        return;
    }

    //var connection = new WebSocket('ws://127.0.0.1:1337');
    var connection = new WebSocket('ws://api.firstruleoffight.club:1337');

    function initialize() {
      $.ajax({
        url: "http://api.firstruleoffight.club/generate",
        async: false,
        success: function (data) {
          var message = new Object();
          var cookieData = readCookie("username");
          message.type = "connection";

          if(getParameterByName("room") == null || getParameterByName("room") == ""){
            message.room = "global";
          }
          else {
            message.room = getParameterByName("room").toLowerCase();
          }
          document.title = message.room;
          if(cookieData == null){
            myName = data;
            myColor = COLORS[Math.floor(Math.random()*COLORS.length)];
          }
          else{
            var crumbles = cookieData.split("/");
            myName = crumbles[0];
            myColor = crumbles[1];
          }

          message.color = myColor;
          message.name = myName;
          $(input).attr('placeholder','Typing as ' + myName);
          //connection.send(JSON.stringify(message));
          sendToServer(message);
        }
      });
        input.removeAttr('disabled').focus();
        initialized = true;
    };

    connection.onerror = function (error) {
        $(input).attr('placeholder','this site is still very under constructionc and appears to be down for a little bit');
    };

    connection.onmessage = function (message) {
      try {
          var json = JSON.parse(message.data);
      } catch (e) {
          console.log('This doesn\'t look like valid JSON: ', message.data);
          return;
      }

      switch (json.type) {
        case "message":
            input.removeAttr('disabled').focus();
            addMessage(json.data.author, json.data.text, json.data.color);
            break;
        case "whisper":
            input.removeAttr('disabled').focus();
            addMessage(json.author, json.text, json.color);
            break;
        case "userConnect":
            users.push(json.data.userName);
            userCounter.html(json.data.userCount);
            updateStillHere(json.data.userName, true);
            break;
        case "userDisconnect":
            users.splice(users.indexOf(json.data.userName), 1);
            userCounter.html(json.data.userCount);
            updateStillHere(json.data.userName, false);
            break;
        case "allClients":
            users = json.data;
            break;
        case "history":
            for (var i=0; i < json.data.length; i++) {
                var temp = JSON.parse(json.data[i]);
                addMessage(temp.data.author, temp.data.text, temp.data.color);
            }
            content.append("<div class='interfaceMessage'>welcome the the chat! type /help for a list of commands</div>");
            adjustGarbage(1);
            scrollDown();
            break;
        case "captchaVerification":
            if(json.data == "success"){
              $(".g-recaptcha").fadeOut("slow");
              messagesSent = 0;
              captchaVerified = true;
              if (!initialized) {
                initialize();
              }
              else{
                input.removeAttr('disabled').focus();
              }
            }
            else {
              grecaptcha.reset();
              content.append("<div class='interfaceMessage'>sorry, but we couldn't verify your captcha!</div>");
            }
            break;
        default:
            console.log("Unrecognized message type", json);
      }
    };

    /**
     * Listeners
     */
     //Handles the users input when they press enter with the focus on the text box
    input.keydown(function(e) {
      if (e.keyCode === 13) {
        var msg = $(this).val();

        if (!msg.trim()) {
          $(this).val('');
          return;
        }
        if(parseCommands(msg)){
          scrollDown();
          $(this).val(null);
          suggestion.html("");
          return;
        }
        if(msg.length > 140){
          return;
        }

        sendMessage(msg);
      }
      else if(e.keyCode === 39){
        var msg = $(this).val();
        autoComplete(msg, true);
      }
    });

    //Adjusts the value of the character limit counter whenever the user adds or removes text
    input.on("input", function(){
      var msg = $(this).val();
      autoComplete(msg, false);
      updateCharacterCounter(msg);
    });

    //Will automaticaly fade the show more messages box out if the user scrolls down on their own
    $(scrollObj).scroll(function() {
       if(scrollObj.scrollTop >= scrollObj.scrollHeight - document.body.clientHeight - 15) {
           $(more).fadeOut('slow', function(){})
       }
    });

    //Used for selecting a new color
    $('body').on('click', '.colorBlock', function(){
      var message = new Object();
      message.type = "color";
      message.color = this.style.backgroundColor;
      //connection.send(JSON.stringify(message));
      sendToServer(message);
      content.append("<div class='interfaceMessage'> You have successfully changed your color to <div class='colorBlockSuccess' style='background-color:" + this.style.backgroundColor + "'></div></div>");
      scrollDown();
    });

    //Adds a username to the text box whenever one is clicked
    $('body').on('click', '.username', function(e){
      var username = $(this).html().replace("@", "");
      if(e.shiftKey){
        var objects = $("." + username);
        var temp = objects.css("backgroundColor");
        if(objects.css("backgroundColor") == "rgba(0, 0, 0, 0)"){
          objects.css("backgroundColor", getBackgroundColor());
        }
        else{
          objects.css("backgroundColor", "rgba(0, 0, 0, 0)");
          backgroundColorCounter--;
        }
      }
      else{
          input.val( input.val() + "@" + username + " " ).focus();
      }
    });

    //For the show more messages box
    $('body').on('click', '#more', function(){
      scrollDown();
      $(this).fadeOut('slow', function(){})
    });

    /**
     * Other Functions
     */

     function autoComplete(msg, autoCompleteBool){
       if(msg.charAt(0) == "/"){
         if(msg.length == 1){
           suggestion.html("/help");
           if(autoCompleteBool){
             input.val("/help ").focus();
           }
         }
         else{
           for (var i = 0; i < VALID_COMMANDS.length; i++) {
             if(msg == VALID_COMMANDS[i].substring(0, msg.length)){
               suggestion.html(VALID_COMMANDS[i]);
               if(autoCompleteBool){
                 input.val(VALID_COMMANDS[i] + " ").focus();
               }
               break;
             }
             else{
               suggestion.html("");
             }
           }
         }
       }
       else {
         suggestion.html("");
       }
     }

     function sendMessage(msg){
       var message = new Object();
       message.type = "message";
       message.text = msg;
       //connection.send(JSON.stringify(message));
       sendToServer(message);
       input.val(null);
       updateCharacterCounter(input.val());
       input.attr('disabled', 'disabled');
     }

     function whisper(msg, targetUser){
       var message = new Object();
       message.type = "whisper";
       message.targetUser = targetUser;
       message.text = msg.replace("/whisper", "*whisper*") + " *whisper*";
       //connection.send(JSON.stringify(message));
       sendToServer(message);
       input.val(null);
       updateCharacterCounter(input.val());
       input.attr('disabled', 'disabled');
     }

     function sendToServer(object){
       if(messagesSent <= MAXMESSAGES && captchaVerified){
         messagesSent++;
         connection.send(JSON.stringify(object));
       }
       else{
         captchaVerified = false;
         grecaptcha.reset();
         $(".g-recaptcha").fadeIn("slow");
         content.append("<p class='interfaceMessage'> sorry, but it looks like you need to complete the captcha before you can send more messages</p>");
         scrollDown();
         adjustGarbage(1);
       }
     }

     var verifyCaptcha = function (){
       if(grecaptcha.getResponse() != ""){
         var message = new Object();
         message.type = "captchaToken";
         message.text = grecaptcha.getResponse();
         connection.send(JSON.stringify(message));
       }
     }
     window.verifyCaptcha = verifyCaptcha;

    function updateStillHere(username, toggleBool){
      var usernames = $(".username");
      for (var i = 0; i < usernames.length; i++) {
        if(usernames[i].innerHTML == "@" + username || usernames[i].innerHTML == username){
          if(toggleBool){
            if(!usernames[i].className.includes("stillHere")){
              usernames[i].className = usernames[i].className + " stillHere";
            }
          }
          else{
            if(inArrayCaseInsensitive(username, users) == -1){
              usernames[i].className = usernames[i].className.replace(" stillHere", "");
            }
          }
        }
      }
    }

    function inArrayCaseInsensitive(searchValue, array){
        var defaultResult = -1;
        var result = defaultResult;
        $.each(array, function(index, value) {
            if (result == defaultResult && searchValue.toLowerCase() == value.toLowerCase()) {
                result = index;
            }
        });
        return result;
    }

    function parseCommands(message){
      var msg = message.replaceAll("@", "");
      var words = msg.trim().split(' ');
      switch(words[0].toLowerCase()){
        case "/whisper":
            if (inArrayCaseInsensitive(words[1], users) != -1) {
              whisper(message, words[1].toLowerCase());
            }
            else{
              content.append("<p class='interfaceMessage'> sorry, but it doesn't look like " + words[1] + " is here");
              adjustGarbage(1);
            }
            return true;
        case "/colors":
            for(var i = 0; i < COLORS.length; i++){
              content.append('<div class="colorBlock" style="background-color:' + COLORS[i] + '"></div>');
            }
            return true;
        case "/mute":
            if(words.length == 2){
              if(words[1] != myName){
                content.append("<p class='interfaceMessage'> you will no longer recieve messages from " + words[1]);
                muteList.push(words[1].toLowerCase());
                removeMessages(words[1]);
              }
              else{
                content.append("<p class='interfaceMessage'> you can't mute yourself, silly ");
              }
            }
            else if(words.length > 1){
              var message = "<p class='interfaceMessage'> you will no longer recieve messages from ";
              for(var i = 1; i < words.length; i++){
                if(words[i].trim() != "" && words[i]){
                  if(i == words.length - 1){
                    message = message + "or " + words[i] + ".";
                  }
                  else if(i == words.length - 2){
                    message = message + words[i] + " ";
                  }
                  else{
                    message = message + words[i] + ", ";
                  }
                  if(words[i] != myName){
                    muteList.push(words[i].toLowerCase());
                    removeMessages(words[i]);
                  }
                }
              }

              content.append(message);
            }
            adjustGarbage(1);
            return true;
        case "/room":
            if(words[1].trim() != null && words[1].trim() != ''){
              sendMessage(words[0] + " " + words[1]);
            }
            return true;
        case "/remember":
            createCookie("username", myName + "/" + myColor, 365);
            content.append("<p class='interfaceMessage'> you will now be remembered as " + myName +" </p>");
            adjustGarbage(1);
            return true;
        case "/forget":
            eraseCookie("username");
            content.append("<p class='interfaceMessage'> you will no longer be remembered as " + myName +" </p>");
            adjustGarbage(1);
            return true;
        case "/help":
            content.append("<p class='interfaceMessage'> &nbsp;</p>");
            content.append("<p class='interfaceMessage'> clicking a username populates the chat box with it</p>");
            content.append("<p class='interfaceMessage'> shift + clicking a username highlights their messages</p>");
            content.append("<p class='interfaceMessage'> right arrow key autocompletes commands</p>");
            content.append("<p class='interfaceMessage'> /whisper - allows you to message a single user in the current chat - usage: /whisper @username message</p>");
            content.append("<p class='interfaceMessage'> /mute - ignores messages from usernames given after command - usage: /mute @username1 @username2</p>");
            content.append("<p class='interfaceMessage'> /room - sends all users a link to a new room which can be specified after the command - usage: /room roomName</p>");
            content.append("<p class='interfaceMessage'> /colors - provides a list of colors to choose from</p>");
            content.append("<p class='interfaceMessage'> /remember - remembers your username and color</p>");
            content.append("<p class='interfaceMessage'> /forget - forgets any stored username and color</p>");
            content.append("<p class='interfaceMessage'> &nbsp;</p>");
            adjustGarbage(10);
            return true;
        default:
            return false;
      }
    }

    function updateCharacterCounter(msg){
      var limit = 140 - msg.length;
      characterLimit.html(limit);

      if(limit < 0){
        characterLimit.css("color", "tomato");
      }
      else{
        characterLimit.css("color", "#46454b");
      }
    }

    function removeMessages(username){
      username = username.replace("@", "");
      $("." + username).remove();
    }

    function scrollDown(){
      scrollObj.scrollTop = scrollObj.scrollHeight;
    }

    function adjustGarbage(adjustments){
      for (var i = 0; i < adjustments; i++) {
        if(garbage.height() > 50){ //Reduces tbe size of the invisible block that makes the messages stick to the bottom
          garbage.height(garbage.height() - 18);
        }
      }
    }

    function addMessage(author, message, color) {
      if(inArrayCaseInsensitive(author, muteList) != -1){//Doesn't send the message if it's from a user that's been muted.
        return;
      }

      adjustGarbage(1);
      //Serves to delete old messages
      var element = document.getElementById("wrapper");
      if(element.children.length > 101){
        element.children[1].remove();
      }
      //Parses out every time a user @'s somebody
      message = parseSignificants(message);

      if(author === myName){ //Adds a style to the username if it belongs to the client
        content.append('<p id="' + author + '"><span class="myMessage" style="color:' + color + '">' + author + '</span> ' + ' ' + message + '</p>');
        scrollDown();
      }
      else{
        //Determines whether or not the page should automaticaly scroll down to the new message
        var scrollDownBool = (scrollObj.scrollTop >= scrollObj.scrollHeight - document.body.clientHeight - 15);
        content.append('<p class="' + author + '"><span class="username" style="color:' + color + '">' + author + '</span> ' + ' ' + message + '</p>');
        if(scrollDownBool){
          scrollDown();
        }
        else{//adds the show more messages block to the screen
          $(more).fadeIn( "slow", function(){});
        }
      }
    }

    function parseSignificants(message){
      var words = message.split(" ");

      if(words[0] == "/room"){
        for (var i = 1; i < words.length; i++) {
          if(words[i].trim() != ""){
            break;
          }
        }
        // return "join this room! <a class='room' target='_blank' href='file:///Users/zac/Desktop/Chat/chat.html?room=" + words[i] + "'>" + words[i] + "</a> ";
        return "join this room! <a class='room' target='_blank' href='http://firstruleoffight.club/chat/chat.html?room=" + words[i] + "'>" + words[i] + "</a> ";
      }

      for (var i = 0; i < words.length; i++) {
        var temp = words[i].replace("@", "");
        if(temp == myName){
          words[i] = "<span class='mentionsMe'>" + words[i] + "</span> "
        }
        else if (inArrayCaseInsensitive(temp, users) != -1){
          words[i] = "<span class='username stillHere'>" + words[i] + "</span> "
        }
        else if(words[i].charAt(0) == "@"){
          words[i] = "<span class='username'>" + words[i] + "</span> "
        }
        else if(words[i] == "*whisper*"){
          words[i] = "<span class='whisper'>" + words[i] + "</span> "
        }
      }

      return words.join(" ");
    }

    function getParameterByName(name, url) {//Gets the url parameter
        if (!url) {
          url = window.location.href;
        }
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    function getBackgroundColor(){
      if(backgroundColorCounter == BACKGROUND_COLORS.length){
        backgroundColorCounter = 0;
      }
      return BACKGROUND_COLORS[backgroundColorCounter++];
    }

    /**
     * Cookie Functions
     */
    function createCookie(name,value,days) {
    	if (days) {
    		var date = new Date();
    		date.setTime(date.getTime()+(days*24*60*60*1000));
    		var expires = "; expires="+date.toGMTString();
    	}
    	else var expires = "";
    	document.cookie = name+"="+value+expires+"; path=/";
    }

    function readCookie(name) {
    	var nameEQ = name + "=";
    	var ca = document.cookie.split(';');
    	for(var i=0;i < ca.length;i++) {
    		var c = ca[i];
    		while (c.charAt(0)==' ') c = c.substring(1,c.length);
    		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    	}
    	return null;
    }

    function eraseCookie(name) {
    	createCookie(name,"",-1);
    }
});
