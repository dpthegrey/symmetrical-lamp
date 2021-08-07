let MyApp = (function () {
  function init(uid, mid) {
    event_process_for_signaling_server();
  }
  var socket = null;
  function event_process_for_signaling_server() {
    //console.log("event_process_for_signaling_server");
    socket = io.connect();
    socket.on("connect", () => {
      alert("socket connected to client side");
    });
  }

  return {
    _init(uid, mid) {
      init(uid, mid);
    },
  };
})();
