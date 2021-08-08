let AppProcess = function () {
  let iceConfiguration = {
    iceServers: [
      {
        url: "stun:stun.l.google.com:19302",
      },
      {
        url: "turn:turn.bistri.com:80",
        credential: "homeo",
        username: "homeo",
      },
      {
        url: "turn:turn.anyfirewall.com:443?transport=tcp",
        credential: "webrtc",
        username: "webrtc",
      },
    ],
  };

  function setConnection(connId) {
    let connection = new RTCPeerConnection(iceConfiguration);
  }

  return {
    setNewConnection: async function (connId) {
      await setConnection(connId);
    },
  };
};

let MyApp = (function () {
  var socket = null;
  var user_id = "";
  var meeting_id = "";
  function init(uid, mid) {
    user_id = uid;
    meeting_id = mid;
    event_process_for_signaling_server();
  }
  function event_process_for_signaling_server() {
    //console.log("event_process_for_signaling_server");
    socket = io.connect();
    socket.on("connect", () => {
      if (socket.connected) {
        if (user_id != "" && meeting_id != "") {
          socket.emit("userconnect", {
            displayName: user_id,
            meetingID: meeting_id,
          });
        }
      }
    });

    socket.on("inform_others_about_me", (data) => {
      //console.log("inform_others_about_me");
      //console.log(data);
      addUser(data.other_user_id, data.connId);
      AppProcess.setNewConnection(data.connId);
    });
  }

  function addUser(other_user_id, connId) {
    //console.log("addUser");
    //console.log(other_user_id);
    //console.log(connId);
    var newDivId = $("#otherTemplate").clone();
    newDivId = newDivId.attr("id", "connId").addClass("other");
    newDivId.find("h2").text(other_user_id);
    newDivId.find("video").attr("id", `v_${connId}`);
    newDivId.find("audio").attr("id", `a_${connId}`);
    newDivId.show();
    $("#divUsers  ").append(newDivId);
  }

  return {
    _init(uid, mid) {
      init(uid, mid);
    },
  };
})();
