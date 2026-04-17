const mongoose = require('mongoose');

// Room details schema - stores information about each room
const roomDetailSchema = new mongoose.Schema({
  numberOfSwitches: { type: Number, required: true },
  importance: { type: Number, default: 3, min: 1, max: 10 } // Default importance: 3 (Flexible)
}, { _id: false });

const structureSchema = new mongoose.Schema({
  numRooms: { type: Number, required: true },
  rooms: {
    type: Map,
    of: roomDetailSchema, // room name -> {numberOfSwitches, importance}
    required: true
  }
});

/**
 * Pre-save hook to ensure all rooms have default importance of 3
 * if not explicitly set
 */
structureSchema.pre('save', function(next) {
  if (this.rooms) {
    this.rooms.forEach((roomDetail) => {
      if (roomDetail.importance === undefined || roomDetail.importance === null) {
        roomDetail.importance = 3;
      }
    });
  }
  next();
});

module.exports = mongoose.model('Structure', structureSchema);