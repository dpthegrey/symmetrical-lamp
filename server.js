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

io.on("connection", (socket) => {
  console.log("your unique socket id is: " + socket.id);
});
