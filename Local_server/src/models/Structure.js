const mongoose = require('mongoose');

const structureSchema = new mongoose.Schema({
  numRooms: { type: Number, required: true },
  rooms: {
    type: Map,
    of: Number, // room name -> number of switches
    required: true
  }
});

module.exports = mongoose.model('Structure', structureSchema);