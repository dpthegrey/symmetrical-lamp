let AppProcess = (function () {
  let peers_connection_ids = []; // Array of connection ids of peers
  let peers_connection = []; // Array of connections of peers
  let remote_vid_stream = []; // Array of remote video stream
  let remote_aud_stream = []; // Array of remote audio stream
  let local_div; // Local video container
  let serverProcess; // Server process
  let audio; // Audio element
  let isAudioMute = true; // Mute or unmute audio
  let rtp_audio_senders = []; // Array of RTP audio senders
  let video_states = {
    None: 0,
    Camera: 1,
    ScreenShare: 2,
  };
  let video_st = video_states.None; // Initialise video state to None
  let videoCamTrack; // Video camera track
  let rtp_vid_senders = []; // Array of RTP video senders
  // We are taking SDP_function & my_connId from MyApp on socket connection
  async function _init(SDP_function, my_connId) {
    serverProcess = SDP_function;
    my_connection_id = my_connId;
    // This eventProcess will handle audio and video for our app
    eventProcess();
    // Store local div player
    local_div = document.getElementById("localVideoPlayer");
  }
  function eventProcess() {
    $("#micMuteUnmute").on("click", async function () {
      if (!audio) {
        await loadAudio();
      }
      if (!audio) {
        alert("Audio permission has not granted");
        return;
      }
      if (isAudioMute) {
        // Unmute audio
        audio.enabled = true;
        $(this).html(`<span class="material-icons">mic</span>`);
        updateMediaSenders(audio, rtp_audio_senders);
      } else {
        // Mute audio
        audio.enabled = false;
        $(this).html(`<span class="material-icons">mic-off</span>`);
        removeMediaSenders(rtp_audio_senders);
      }
      // Update isAudioMute to false if already true or true if already false
      isAudioMute = !isAudioMute;
    });
    $("#videoCamOnOff").on("click", async function () {
      // If video state is Camera, then turn off
      if (video_st == video_states.Camera) {
        await videoProcess(video_states.None);
      } else {
        // If video state is not Camera, then turn on
        await videoProcess(video_states.Camera);
      }
    });
    $("#ScreenShareOnOff").on("click", async function () {
      // If video state is ScreenShare, then turn off
      if (video_st == video_states.ScreenShare) {
        await videoProcess(video_states.None);
      } else {
        // If video state is not ScreenShare, then turn on
        await videoProcess(video_states.ScreenShare);
      }
    });
  }
  function connection_status(connection) {
    if (
      connection &&
      (connection.connectionState == "new" ||
        connection.connectionState == "connecting" ||
        connection.connectionState == "connected")
    ) {
      return true;
    } else {
      return false;
    }
  }
  async function updateMediaSenders(track, rtp_senders) {
    for (var con_id in peers_connection_ids) {
      if (connection_status(peers_connection[con_id])) {
        if (rtp_senders[con_id] && rtp_senders[con_id].track) {
          rtp_senders[con_id].replaceTrack(track);
        } else {
          rtp_senders[con_id] = peers_connection[con_id].addTrack(track);
        }
      }
    }
  }
  async function videoProcess(newVideoState) {
    try {
      let vstream = null;

      if (newVideoState == video_states.Camera) {
        vstream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
      } else if (newVideoState == video_states.ScreenShare) {
        vstream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
      }
      if (vstream && vstream.getVideoTracks().length > 0) {
        // Get the exact video track from vstream and store it in videoCamTrack
        videoCamTrack = vstream.getVideoTracks()[0];
        // Load this tracks as source object for local div
        if (videoCamTrack) {
          // Set the video stream to local div
          local_div.srcObject = new MediaStream([videoCamTrack]);
          alert("Video stream is loaded");
        }
      }
    } catch (e) {
      console.log("getUserMedia error: " + e);
      return;
    }
    video_st = newVideoState;
  }

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

  // We are taking SDP_function & my_connId from MyApp on socket connection
  async function setConnection(connId) {
    let connection = new RTCPeerConnection(iceConfiguration);

    connection.onnegotiationneeded = async function (event) {
      await setOffer(connId);
    };
    connection.onicecandidate = function (event) {
      if (event.candidate) {
        serverProcess(
          JSON.stringify({
            icecandidate: event.candidate,
          }),
          connId
        );
      }
    };

    // This connection.ontrack basically will happen/occur
    // when there will be available track in the connection
    connection.ontrack = function (event) {
      console.log("on track", event);

      if (!remote_vid_stream[connId]) {
        remote_vid_stream[connId] = new MediaStream();
      }
      if (!remote_aud_stream[connId]) {
        remote_aud_stream[connId] = new MediaStream();
      }

      // this will run if video.track is available on the event
      if (event.track.kind == "video") {
        remote_vid_stream[connId]
          .getVideoTrack()
          .forEach((t) => remote_vid_stream[connId].removeTrack(t)); // Remove track if it exists
        remote_vid_stream[connId].addTrack(event.track); // Add video track
        // Get video player
        let remoteVideoPlayer = document.getElementById("v_" + connId);
        remoteVideoPlayer.srcObject = null;
        remoteVideoPlayer.srcObject = remote_vid_stream[connId]; // Set video stream
        remoteVideoPlayer.load(); // Load video stream
      } else if (event.track.kind == "audio") {
        remote_aud_stream[connId]
          .getAudioTracks()
          .forEach((t) => remote_aud_stream[connId].removeTrack(t)); // Remove track if it exists
        remote_aud_stream[connId].addTrack(event.track); // Add audio track
        // Get audio player
        let remoteAudioPlayer = document.getElementById("a_" + connId);
        remoteAudioPlayer.srcObject = null;
        remoteAudioPlayer.srcObject = remote_aud_stream[connId]; // Set audio stream
        remoteAudioPlayer.load(); // Load audio stream
      }
    };
    peers_connection_ids[connId] = connId; // Add connection id to array
    peers_connection[connId] = connection; // Add connection to array

    if (
      video_st == video_states.Camera ||
      video_st == video_states.ScreenShare
    ) {
      updateMediaSenders(videoCamTrack, rtp_vid_senders);
    }
    return connection;
  }

  // This function will be called when socket connection is made
  async function setOffer(connId) {
    // Get connection from array and store it in the variable
    let connection = peers_connection[connId];
    // Create offer
    let offer = await connection.createOffer();
    // Set local description using created offer
    await connection.setLocalDescription(offer);
    // Send offer to peer
    serverProcess(
      JSON.stringify(
        {
          // sending offer property with value of local
          // description to other users
          // in order to identify my connection
          offer: connection.localDescription,
        },
        connId
      )
    );
  }

  // This function will be called when other user will send
  async function SDPProcess(message, from_connId) {
    message = JSON.parse(message);
    // receive answer from other user
    if (message.answer) {
      // Set the answer as remote description for that sender
      await peers_connection[from_connId].setRemoteDescription(
        new RTCSessionDescription(message.answer)
      );
    } else if (message.offer) {
      // Check if the offer is in the peer connection or not
      if (!peers_connection[from_connId]) {
        // If connection is not created then create it
        await setConnection(from_connId);
      }
      // Set remote description using received offer
      await peers_connection[from_connId].setRemoteDescription(
        new RTCSessionDescription(message.offer)
      );
      // Create answer on behalf of this offer
      let answer = await peers_connection[from_connId].createAnswer();
      // Set answer for other user's local description
      await peers_connection[from_connId].setLocalDescription(answer);
      // Send answer to peer
      serverProcess(
        JSON.stringify({
          // sending answer property to whom we got the offer by returning it
          answer: answer,
        }),
        from_connId
      );
    } else if (message.icecandidate) {
      if (!peers_connection[from_connId]) {
        await setConnection(from_connId);
      }
      try {
        await peers_connection[from_connId].addIceCandidate(
          message.icecandidate
        );
      } catch (e) {
        console.log(e);
      }
    }
  }

  return {
    // This function will be called when socket connection is made
    setNewConnection: async function (connId) {
      await setConnection(connId);
    },
    init: async function (SDP_function, my_connId) {
      await _init(SDP_function, my_connId);
    },
    //
    processClientFunc: async function (data, from_connId) {
      await SDPProcess(data, from_connId);
    },
  };
})();

let MyApp = (function () {
  var socket = null;
  var user_id = "";
  var meeting_id = "";
  function init(uid, mid) {
    user_id = uid;
    meeting_id = mid;
    // show video in div
    $("#meetingContainer").show();
    // show username
    $("#me h2").text(`${user_id} (Me)`);
    // Set user's name in title area
    document.title = user_id;
    event_process_for_signaling_server();
  }
  function event_process_for_signaling_server() {
    //console.log("event_process_for_signaling_server");
    socket = io.connect();

    let SDP_function = function (data, to_connId) {
      // this will go to server.js on the event of SDPProcess
      socket.emit("SDPProcess", {
        message: data,
        to_connId: to_connId,
      });
    };
    socket.on("connect", () => {
      console.log("socket connected");
      if (socket.connected) {
        AppProcess.init(SDP_function, socket.id);
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
      addUser(data.other_user_id, data.connId, data.userNumber);
      AppProcess.setNewConnection(data.connId);
    });
    socket.on("inform_me_about_other_user", function (other_users) {
      //console.log("inform_me_about_other_user");
      //console.log(other_users);
      if (other_users.length > 0) {
        for (let i = 0; i < other_users.length; i++) {
          addUser(other_users[i].user_id, other_users[i].connectionId);
          AppProcess.setNewConnection(other_users[i].connectionId);
        }
      }
    });
    socket.on("SDPProcess", async function (data) {
      await AppProcess.processClientFunc(data.message, data.from_connId);
    });
  }

  function addUser(other_user_id, connId) {
    //console.log("addUser");
    //console.log(other_user_id);
    //console.log(connId);
    var newDivId = $("#otherTemplate").clone();
    newDivId = newDivId.attr("id", "connId").addClass("other");
    newDivId.find("h2").text(other_user_id);
    // when add any user, we set `v_${connId}` to a particular video
    newDivId.find("video").attr("id", `v_${connId}`);
    // when add any user, we set `a_${connId}` to a particular audio
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
