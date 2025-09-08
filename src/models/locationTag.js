const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LocationTag = sequelize.define('LocationTag', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'location_tags',
  timestamps: true,
});

module.exports = LocationTag;
