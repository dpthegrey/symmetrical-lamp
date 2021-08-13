let AppProcess = (function () {
  let peers_connection_ids = []; // Array of connection ids of peers
  let peers_connection = []; // Array of connections of peers
  let remote_vid_stream = []; // Array of remote video stream
  let remote_aud_stream = []; // Array of remote audio stream
  let local_div; // Local video container
  let serverProcess; // Server process
  let audio; // Audio element
  let isAudioMute = true; // Mute or unmute audio
  let rtp_aud_senders = []; // Array of RTP audio senders
  let video_states = {
    None: 0,
    Camera: 1,
    ScreenShare: 2,
  };
  let video_st = video_states.None; // Initialise video state to None
  let videoCamTrack; // Video camera track
  let rtp_vid_senders = []; // Array of RTP video senders
  // We are taking SDP_function & my_connid from MyApp on socket connection
  async function _init(SDP_function, my_connid) {
    serverProcess = SDP_function;
    my_connection_id = my_connid;
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
        $(this).html(
          `<span class="material-icons" style="width:100%;">mic</span>`
        );
        updateMediaSenders(audio, rtp_aud_senders);
      } else {
        // Mute audio
        audio.enabled = false;
        $(this).html(
          `<span class="material-icons" style="width:100%;">mic_off</span>`
        );
        removeMediaSenders(rtp_aud_senders);
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
  async function loadAudio() {
    try {
      let astream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      audio = astream.getAudioTracks()[0];
      audio.enabled = false;
    } catch (e) {
      console.log(e);
    }
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
    for (let con_id in peers_connection_ids) {
      if (connection_status(peers_connection[con_id])) {
        if (rtp_senders[con_id] && rtp_senders[con_id].track) {
          rtp_senders[con_id].replaceTrack(track);
        } else {
          rtp_senders[con_id] = peers_connection[con_id].addTrack(track);
        }
      }
    }
  }
  function removeMediaSenders(rtp_senders) {
    for (let con_id in peers_connection_ids) {
      if (rtp_senders[con_id] && connection_status(peers_connection[con_id])) {
        peers_connection[con_id].removeTrack(rtp_senders[con_id]);
        rtp_senders[con_id] = null;
      }
    }
  }
  function removeVideoStream(rtp_vid_senders) {
    if (videoCamTrack) {
      videoCamTrack.stop();
      videoCamTrack = null;
      local_div.srcObject = null;
      removeMediaSenders(rtp_vid_senders);
    }
  }
  async function videoProcess(newVideoState) {
    if (newVideoState == video_states.None) {
      $("#videoCamOnOff").html(
        "<span class='material-icons' style='width:100%;'>videocam_off</span>"
      );
      $("#ScreenShareOnOff").html(
        '<span class="material-icons">present_to_all</span><div>Present Now</div>'
      );
      video_st = newVideoState;

      removeVideoStream(rtp_vid_senders);
      return;
    }
    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html(
        "<span class='material-icons' style='width:100%;'>videocam_on</span>"
      );
    }
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
        vstream.oninactive = (e) => {
          removeVideoStream(rtp_vid_senders);
          $("#ScreenShareOnOff").html(
            `<span class="material-icons">present_to_all</span><div >Present Now</div>`
          );
        };
      }
      if (vstream && vstream.getVideoTracks().length > 0) {
        // Get the exact video track from vstream and store it in videoCamTrack
        videoCamTrack = vstream.getVideoTracks()[0];
        // Load this tracks as source object for local div
        if (videoCamTrack) {
          // Set the video stream to local div
          local_div.srcObject = new MediaStream([videoCamTrack]);
          updateMediaSenders(videoCamTrack, rtp_vid_senders);
        }
      }
    } catch (e) {
      console.log("getUserMedia error: " + e);
      return;
    }
    video_st = newVideoState;
    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html(
        '<span class="material-icons" style="width: 100%;">videocam</span>'
      );
      $("#ScreenShareOnOff").html(
        '<span class="material-icons ">present_to_all</span><div >Present Now</div>'
      );
    } else if (newVideoState == video_states.ScreenShare) {
      $("#videoCamOnOff").html(
        '<span class="material-icons" style="width: 100%;">videocam_off</span>'
      );
      $("#ScreenShareOnOff").html(
        '<span class="material-icons text-success">present_to_all</span><div class="text-success">Stop Present Now</div>'
      );
    }
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
  async function setConnection(connid) {
    let connection = new RTCPeerConnection(iceConfiguration);

    connection.onnegotiationneeded = async function (event) {
      await setOffer(connid);
    };
    connection.onicecandidate = function (event) {
      if (event.candidate) {
        serverProcess(
          JSON.stringify({ icecandidate: event.candidate }),
          connid
        );
      }
    };

    // This connection.ontrack basically will happen/occur
    // when there will be available track in the connection
    connection.ontrack = function (event) {
      console.log("on track", event);

      if (!remote_vid_stream[connid]) {
        remote_vid_stream[connid] = new MediaStream();
      }
      if (!remote_aud_stream[connid]) {
        remote_aud_stream[connid] = new MediaStream();
      }

      // this will run if video.track is available on the event
      if (event.track.kind == "video") {
        remote_vid_stream[connid]
          .getVideoTracks()
          .forEach((t) => remote_vid_stream[connid].removeTrack(t)); // Remove track if it exists
        remote_vid_stream[connid].addTrack(event.track); // Add video track
        // Get video player
        let remoteVideoPlayer = document.getElementById("v_" + connid);
        remoteVideoPlayer.srcObject = null;
        remoteVideoPlayer.srcObject = remote_vid_stream[connid]; // Set video stream
        remoteVideoPlayer.load(); // Load video stream
      } else if (event.track.kind == "audio") {
        remote_aud_stream[connid]
          .getAudioTracks()
          .forEach((t) => remote_aud_stream[connid].removeTrack(t)); // Remove track if it exists
        remote_aud_stream[connid].addTrack(event.track); // Add audio track
        // Get audio player
        let remoteAudioPlayer = document.getElementById("a_" + connid);
        remoteAudioPlayer.srcObject = null;
        remoteAudioPlayer.srcObject = remote_aud_stream[connid]; // Set audio stream
        remoteAudioPlayer.load(); // Load audio stream
      }
    };
    peers_connection_ids[connid] = connid; // Add connection id to the list
    peers_connection[connid] = connection; // Add connection to the list

    if (
      video_st == video_states.Camera ||
      video_st == video_states.ScreenShare
    ) {
      if (videoCamTrack) {
        updateMediaSenders(videoCamTrack, rtp_vid_senders);
      }
    }

    return connection;
  }

  // This function will be called when socket connection is made
  async function setOffer(connid) {
    // Get connection from array and store it in the variable
    let connection = peers_connection[connid];
    // Create offer
    let offer = await connection.createOffer();
    // Set local description using created offer
    await connection.setLocalDescription(offer);
    // Send offer to the other peer
    serverProcess(
      JSON.stringify({
        // sending offer property with value of local
        // description to other users
        // in order to identify my connection
        offer: connection.localDescription,
      }),
      connid
    );
  }

  // This function will be called when other user will send
  async function SDPProcess(message, from_connid) {
    message = JSON.parse(message);
    // receive answer from other user
    if (message.answer) {
      // Set the answer as remote description for that sender
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.answer)
      );
    } else if (message.offer) {
      // Check if the offer is in the peer connection or not
      if (!peers_connection[from_connid]) {
        // If connection is not created then create it
        await setConnection(from_connid);
      }
      // Set the offer as remote description for that sender
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.offer)
      );
      // Create answer on behalf of this offer
      let answer = await peers_connection[from_connid].createAnswer();
      // Set answer for other user's local description
      await peers_connection[from_connid].setLocalDescription(answer);
      // Send answer to the other peer
      serverProcess(
        JSON.stringify({
          // sending answer property to whom we got the offer by returning it
          answer: answer,
        }),
        from_connid
      );
    } else if (message.icecandidate) {
      if (!peers_connection[from_connid]) {
        await setConnection(from_connid);
      }
      try {
        await peers_connection[from_connid].addIceCandidate(
          message.icecandidate
        );
      } catch (e) {
        console.log(e);
      }
    }
  }
  async function closeConnection(connid) {
    peers_connection_ids[connid] = null;
    if (peers_connection[connid]) {
      peers_connection[connid].close();
      peers_connection[connid] = null;
    }
    if (remote_aud_stream[connid]) {
      remote_aud_stream[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      remote_aud_stream[connid] = null;
    }
    if (remote_vid_stream[connid]) {
      remote_vid_stream[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      remote_vid_stream[connid] = null;
    }
  }
  return {
    // This function will be called when socket connection is made
    setNewConnection: async function (connid) {
      await setConnection(connid);
    },
    init: async function (SDP_function, my_connid) {
      await _init(SDP_function, my_connid);
    },
    processClientFunc: async function (data, from_connid) {
      await SDPProcess(data, from_connid);
    },
    closeConnectionCall: async function (connid) {
      await closeConnection(connid);
    },
  };
})();

let MyApp = (function () {
  let socket = null;
  let user_id = "";
  let meeting_id = "";
  function init(uid, mid) {
    user_id = uid;
    meeting_id = mid;
    // show video in div
    $("#meetingContainer").show();
    // show username
    $("#me h2").text(user_id + "(Me)");
    document.title = user_id;
    event_process_for_signaling_server();
    eventHandeling();
  }

  function event_process_for_signaling_server() {
    //console.log("event_process_for_signaling_server");
    socket = io.connect();

    let SDP_function = function (data, to_connid) {
      // this will go to server.js on the event of SDPProcess
      socket.emit("SDPProcess", {
        message: data,
        to_connid: to_connid,
      });
    };
    socket.on("connect", () => {
      console.log("socket.on connect");
      if (socket.connected) {
        AppProcess.init(SDP_function, socket.id);
        if (user_id != "" && meeting_id != "") {
          socket.emit("userconnect", {
            displayName: user_id,
            meetingid: meeting_id,
          });
        }
      }
    });
    socket.on("inform_other_about_disconnected_user", function (data) {
      console.log("inform_other_about_disconnected_user");
      $("#" + data.connId).remove();
      $(".participant-count").text(data.uNumber);
      $("#participant_" + data.connId + "").remove();
      AppProcess.closeConnectionCall(data.connId);
    });
    socket.on("inform_others_about_me", function (data) {
      console.log("inform_others_about_me");
      addUser(data.other_user_id, data.connId, data.userNumber);

      AppProcess.setNewConnection(data.connId);
    });
    socket.on("showFileMessage", function (data) {
      console.log("showFileMessage");
      let num_of_att = $(".left-align").length;
      let added_mar = num_of_att * 10;
      let mar_top = "-" + (135 + added_mar);
      $(".g-details").css({ "margin-top": mar_top });

      let time = new Date();
      let lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      let attachFileAreaForOther = document.querySelector(".show-attach-file");

      attachFileAreaForOther.innerHTML +=
        "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/other.jpg' style='height:40px;width:40px;' class='caller-image circle'><div style='font-weight:600;margin:0 5px;'>" +
        data.username +
        "</div>:<div><a style='color:#007bff;' href='" +
        data.filePath +
        "' download>" +
        data.fileName +
        "</a></div></div><br/>";
    });
    socket.on("inform_me_about_other_user", function (other_users) {
      let userNumber = other_users.length;
      let userNumb = userNumber + 1;
      if (other_users) {
        for (let i = 0; i < other_users.length; i++) {
          addUser(
            other_users[i].user_id,
            other_users[i].connectionId,
            userNumb
          );
          AppProcess.setNewConnection(other_users[i].connectionId);
        }
      }
    });
    socket.on("SDPProcess", async function (data) {
      await AppProcess.processClientFunc(data.message, data.from_connid);
    });
    socket.on("showChatMessage", function (data) {
      let time = new Date();
      let lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      let div = $("<div>").html(
        "<span class='font-weight-bold mr-3' style='color:black'>" +
          data.from +
          "</span>" +
          lTime +
          "</br>" +
          data.message
      );
      $("#messages").append(div);
    });
  }
  function eventHandeling() {
    $("#btnsend").on("click", function () {
      let msgData = $("#msgbox").val();
      socket.emit("sendMessage", msgData);
      let time = new Date();
      let lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
      let div = $("<div>").html(
        "<span class='font-weight-bold mr-3' style='color:black'>" +
          user_id +
          "</span>" +
          lTime +
          "</br>" +
          msgData
      );
      $("#messages").append(div);
      $("#msgbox").val("");
    });

    let url = window.location.href;
    $(".meeting_url").text(url);

    $("#divUsers").on("dblclick", "video", function () {
      this.requestFullscreen();
    });
  }

  function addUser(other_user_id, connId, userNum) {
    let newDivId = $("#otherTemplate").clone();
    newDivId = newDivId.attr("id", connId).addClass("other");
    newDivId.find("h2").text(other_user_id);
    newDivId.find("video").attr("id", "v_" + connId);
    newDivId.find("audio").attr("id", "a_" + connId);
    newDivId.show();
    $("#divUsers").append(newDivId);
    $(".in-call-wrap-up").append(
      '<div class="in-call-wrap d-flex justify-content-between align-items-center mb-3" id="participant_' +
        connId +
        '"> <div class="participant-img-name-wrap display-center cursor-pointer"> <div class="participant-img"> <img src="public/Assets/images/other.jpg" alt="" class="border border-secondary" style="height: 40px;width: 40px;border-radius: 50%;"> </div> <div class="participant-name ml-2"> ' +
        other_user_id +
        '</div> </div> <div class="participant-action-wrap display-center"> <div class="participant-action-dot display-center mr-2 cursor-pointer"> <span class="material-icons"> more_vert </span> </div> <div class="participant-action-pin display-center mr-2 cursor-pointer"> <span class="material-icons"> push_pin </span> </div> </div> </div>'
    );
    $(".participant-count").text(userNum);
  }
  $(document).on("click", ".people-heading", function () {
    $(".in-call-wrap-up").show(300);
    $(".chat-show-wrap").hide(300);
    $(this).addClass("active");
    $(".chat-heading").removeClass("active");
  });
  $(document).on("click", ".chat-heading", function () {
    $(".in-call-wrap-up").hide(300);
    $(".chat-show-wrap").show(300);
    $(this).addClass("active");
    $(".people-heading").removeClass("active");
  });
  $(document).on("click", ".meeting-heading-cross", function () {
    $(".g-right-details-wrap").hide(300);
  });
  $(document).on("click", ".top-left-participant-wrap", function () {
    $(".people-heading").addClass("active");
    $(".chat-heading").removeClass("active");
    $(".g-right-details-wrap").show(300);
    $(".in-call-wrap-up").show(300);
    $(".chat-show-wrap").hide(300);
  });
  $(document).on("click", ".top-left-chat-wrap", function () {
    $(".people-heading").removeClass("active");
    $(".chat-heading").addClass("active");
    $(".g-right-details-wrap").show(300);
    $(".in-call-wrap-up").hide(300);
    $(".chat-show-wrap").show(300);
  });
  $(document).on("click", ".end-call-wrap", function () {
    $(".top-box-show")
      .css({
        display: "block",
      })
      .html(
        '<div class="top-box align-vertical-middle profile-dialogue-show"> <h4 class="mt-3" style="text-align:center;color:white;">Leave Meeting</h4> <hr> <div class="call-leave-cancel-action d-flex justify-content-center align-items-center w-100"> <a href="/action.html"><button class="call-leave-action btn btn-danger mr-5">Leave</button></a> <button class="call-cancel-action btn btn-secondary">Cancel</button> </div> </div>'
      );
  });
  $(document).mouseup(function (e) {
    let container = new Array();
    container.push($(".top-box-show"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length == 0) {
        $(value).empty();
      }
    });
  });
  $(document).mouseup(function (e) {
    let container = new Array();
    container.push($(".g-details"));
    container.push($(".g-right-details-wrap"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length == 0) {
        $(value).hide(300);
      }
    });
  });
  $(document).on("click", ".call-cancel-action", function () {
    $(".top-box-show").html("");
  });
  $(document).on("click", ".copy_info", function () {
    let $temp = $("<input>");
    $("body").append($temp);
    $temp.val($(".meeting_url").text()).select();
    document.execCommand("copy");
    $temp.remove();
    $(".link-conf").show();
    setTimeout(function () {
      $(".link-conf").hide();
    }, 3000);
  });
  $(document).on("click", ".meeting-details-button", function () {
    $(".g-details").slideDown(300);
  });
  $(document).on("click", ".g-details-heading-attachment", function () {
    $(".g-details-heading-show").hide();
    $(".g-details-heading-show-attachment").show();
    $(this).addClass("active");
    $(".g-details-heading-detail").removeClass("active");
  });
  $(document).on("click", ".g-details-heading-detail", function () {
    $(".g-details-heading-show").show();
    $(".g-details-heading-show-attachment").hide();
    $(this).addClass("active");
    $(".g-details-heading-attachment").removeClass("active");
  });
  let base_url = window.location.origin;

  $(document).on("change", ".custom-file-input", function () {
    let fileName = $(this).val().split("\\").pop();
    $(this).siblings(".custom-file-label").addClass("selected").html(fileName);
  });

  $(document).on("click", ".share-attach", function (e) {
    e.preventDefault();
    let att_img = $("#customFile").prop("files")[0];
    let formData = new FormData();
    formData.append("zipfile", att_img);
    formData.append("meeting_id", meeting_id);
    formData.append("username", user_id);
    console.log(formData);
    $.ajax({
      url: base_url + "/attachimg",
      type: "POST",
      data: formData,
      contentType: false,
      processData: false,
      success: function (response) {
        console.log(response);
      },
      error: function () {
        console.log("error");
      },
    });

    let attachFileArea = document.querySelector(".show-attach-file");
    let attachFileName = $("#customFile").val().split("\\").pop();
    let attachFilePath =
      "public/attachment/" + meeting_id + "/" + attachFileName;
    attachFileArea.innerHTML +=
      "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/other.jpg' style='height:40px;width:40px;' class='caller-image circle'><div style='font-weight:600;margin:0 5px;'>" +
      user_id +
      "</div>:<div><a style='color:#007bff;' href='" +
      attachFilePath +
      "' download>" +
      attachFileName +
      "</a></div></div><br/>";
    $("label.custom-file-label").text("");
    socket.emit("fileTransferToOther", {
      username: user_id,
      meetingid: meeting_id,
      filePath: attachFilePath,
      fileName: attachFileName,
    });
  });
  $(document).on("click", ".option-icon", function () {
    $(".recording-show").toggle(300);
  });

  $(document).on("click", ".start-record", function () {
    $(this)
      .removeClass()
      .addClass("stop-record btn-danger text-dark")
      .text("Stop Recording");
    startRecording();
  });
  $(document).on("click", ".stop-record", function () {
    $(this)
      .removeClass()
      .addClass("start-record btn-dark text-danger")
      .text("Start Recording");
    mediaRecorder.stop();
  });

  let mediaRecorder;
  let chunks = [];
  async function captureScreen(
    mediaContraints = {
      video: true,
    }
  ) {
    const screenStream = await navigator.mediaDevices.getDisplayMedia(
      mediaContraints
    );
    return screenStream;
  }
  async function captureAudio(
    mediaContraints = {
      video: false,
      audio: true,
    }
  ) {
    const audioStream = await navigator.mediaDevices.getUserMedia(
      mediaContraints
    );
    return audioStream;
  }
  async function startRecording() {
    const screenStream = await captureScreen();
    const audioStream = await captureAudio();
    const stream = new MediaStream([
      ...screenStream.getTracks(),
      ...audioStream.getTracks(),
    ]);
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    mediaRecorder.onstop = function (e) {
      let clipName = prompt("Enter a name for your recording");
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, {
        type: "video/webm",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = clipName + ".webm";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    };
    mediaRecorder.ondataavailable = function (e) {
      chunks.push(e.data);
    };
  }

  return {
    _init: function (uid, mid) {
      init(uid, mid);
    },
  };
})();
