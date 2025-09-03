```javascript
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const LocationTag = require('./locationTag');

class Content extends Model {}

Content.init({
  // ...existing attributes...
}, {
  sequelize,
  modelName: 'Content',
  tableName: 'contents',
  timestamps: true,
});

// Associations
Content.belongsToMany(LocationTag, { through: 'content_location_tags', foreignKey: 'contentId' });
LocationTag.belongsToMany(Content, { through: 'content_location_tags', foreignKey: 'locationTagId' });

module.exports = Content;
```