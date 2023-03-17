// config.js
const config = {
    app: {
      port: process.env.PORT || 3000,
      logging: true,
      jwtKey: "CBiTJ1q6vfils4h7OJWnmD9UAitA7D8NjYmO0YJozcueHXHJzIl1g48qulklr5i",
      tempFilePath: "uploads/"
    },
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3306,
        username: process.env.DB_USER || 'tsauser',
        password: process.env.DB_PASSWORD || 'my-secret-pw',
        schema: process.env.DB_SCHEMA || 'tsagallery'
    },
    cache: {
      userSessionPrefix: "session:",
      userCollectionKey: "users",
      userKeyPrefix: "user:",
      categoryCollectionKey: "categories",
      categoryKeyPrefix: "category:",
      categoryImagesPrefix: "categoryImages:",
      imageCollectionKey: "images",
      imageKeyPrefix: "image:",
      searchCollectionPrefix: "search:"
    }
};

module.exports = config;
