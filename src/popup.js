import JsSIP from "jssip";

let callSession;
let incomingSession;
let userAgent;
let callHistory = [];
let duration;
let timer;

function registerUser(configuration) {
  const socket = new JsSIP.WebSocketInterface(configuration.ws_servers);
  userAgent = new JsSIP.UA({
    sockets: [socket],
    uri: configuration.uri,
    password: configuration.password,
  });

  userAgent.on("registered", function () {
    alert("Регистрация успешна!");
  });

  userAgent.on("registrationFailed", function () {
    alert("Ошибка регистрации!");
  });

  userAgent.on("newRTCSession", function (e) {
    const session = e.session;

    if (session.direction === "incoming") {
      incomingSession = session;

      incomingSession.on("failed", function (e) {
        updateCallStatus("Завершено" + e.cause);
        addToCallHistory(session.remote_identity.uri.user, "failed");
      });

      incomingSession.on("confirmed", function (e) {
        updateCallStatus("В процессе");
        displayCallInfo(session.remote_identity.uri.user);
        startCallTimer(timer);
      });

      const incomingCall = confirm(
        "Входящий звонок от " + session.remote_identity.uri.user + ". Принять?"
      );

      if (incomingCall) {
        session.answer({
          mediaConstraints: { audio: true, video: true },
        });
      } else {
        session.terminate();
      }
    } else {
      callSession = session;

      callSession.on("progress", function (e) {
        updateCallStatus("В процессе");
        displayCallInfo(session.remote_identity.uri.user);
        startCallTimer();
      });

      callSession.on("confirmed", function (e) {
        updateCallStatus("В процессе");
      });

      callSession.on("failed", function (e) {
        updateCallStatus("Завершено: " + e.cause);
        addToCallHistory(session.remote_identity.uri.user, "failed");
      });

      callSession.on("ended", function (e) {
        updateCallStatus("Завершено: " + e.cause);
        addToCallHistory(session.remote_identity.uri.user, "ended");
      });
    }
  });

  userAgent.start();

  return userAgent;
}

function makeCall(callee, server) {
  if (!userAgent || userAgent.isRegistered() !== true) {
    alert("Пожалуйста, сначала войдите в аккаунт SIP");
    return;
  }

  const callOptions = {
    mediaConstraints: { audio: true, video: true },
  };

  callSession = userAgent.call("sip:" + callee + "@" + server, callOptions);
}

function endCall() {
  if (callSession) {
    callSession.terminate();
    callSession = null;
  } else if (incomingSession) {
    incomingSession.terminate();
    addToCallHistory(incomingSession.remote_identity.uri.user, "ended");
    incomingSession = null;
  }
  duration = null;
  document.getElementById("callDuration").textContent = "";
  document.getElementById("callInfo").style.display = "none";
  clearTimeout(timer);
}

function updateCallStatus(status) {
  const callStatusText = document.getElementById("callStatusText");
  callStatusText.textContent = status;
}

function displayCallInfo(callerName) {
  const callInfoDiv = document.getElementById("callInfo");
  const callerNameSpan = document.getElementById("callerName");
  callerNameSpan.textContent = callerName;
  callInfoDiv.style.display = "block";
}

function startCallTimer() {
  const callStartTime = new Date().getTime();
  const callDurationSpan = document.getElementById("callDuration");

  function updateDuration() {
    const currentTime = new Date().getTime();
    duration = formatDuration(currentTime - callStartTime);
    callDurationSpan.textContent = duration;
  }

  timer = setInterval(updateDuration, 1000);
}

function formatDuration(duration) {
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

function addToCallHistory(callee, status) {
  const call = {
    callee: callee,
    status: status,
    time: new Date().toLocaleString(),
  };
  callHistory.push(call);
  displayCallHistory();
}

function displayCallHistory() {
  const callHistoryList = document.getElementById("callHistory");
  callHistoryList.innerHTML = "";
  callHistory.forEach((call) => {
    const listItem = document.createElement("li");
    listItem.textContent = `${call.time} - ${call.callee}: ${call.status}`;
    callHistoryList.appendChild(listItem);
  });
}

function start() {
  const loginForm = document.getElementById("loginForm");
  const makeCallButton = document.getElementById("makeCall");
  const endCallButton = document.getElementById("endCall");
  const serverInput = document.getElementById("server");
  let serverValue;

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    serverValue = serverInput.value;
    if (!username || !password || !serverValue) {
      alert("Пожалуйста, заполните все поля");
      return;
    }

    const configuration = {
      uri: "sip:" + username + "@" + serverValue,
      password: password,
      ws_servers: "wss://" + serverValue,
    };

    registerUser(configuration);

    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    serverInput.value = "";
  });

  endCallButton.addEventListener("click", function () {
    endCall();
  });

  makeCallButton.addEventListener("click", function () {
    const callee = document.getElementById("callee").value;

    if (!callee || !serverValue) {
      alert("Пожалуйста, введите номер абонента и укажите сервер");
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(
      makeCall(callee, serverValue)
    )
    .catch(function(error) {
      alert('Пожалуйста, разрешите доступ, чтобы совершить звонок.');
    });

    // makeCall(callee, serverValue);
  });
}

document.addEventListener("DOMContentLoaded", start);
