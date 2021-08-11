const express = require("express");
const path = require("path");
let app = express();
let server = app.listen(process.env.PORT || 3000, () => {
  console.log("Listening on port %d", server.address().port);
});

const io = require("socket.io")(server, {
  allowEIO3: true, // false by default
});
app.use(express.static(path.join(__dirname, "")));
var userConnection = [];
io.on("connection", (socket) => {
  console.log("your unique socket id is: " + socket.id);
  socket.on("userconnect", (data) => {
    console.log("user connected: ", data.displayName, data.meetingID);
    var other_users = userConnection.filter(
      (p) => p.meeting_id == data.meetingID
    );
    userConnection.push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingID,
    });

    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("inform_others_about_me"),
        {
          other_user_id: data.displayName,
          connId: socket.id,
        };
    });
    socket.emit("inform_me_about_other_user", other_users);
  });

  // when the client emits 'add_user', this listens and executes
  socket.on("SDPProcess", (data) => {
    socket.to(data.to_connId).emit("SDPProcess", {
      message: data.message,
      from_connId: socket.id,
    });
  });
});
