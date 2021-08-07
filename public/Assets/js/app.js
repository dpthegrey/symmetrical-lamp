let MyApp = (function () {
  function init(uid, mid) {
    alert("From " + uid + " to " + mid);
  }

  return {
    _init(uid, mid) {
      init(uid, mid);
    },
  };
})();
