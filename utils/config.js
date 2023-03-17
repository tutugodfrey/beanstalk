// config.js
const config = {
    app: {
      installId: '58e55d3d-3f14-4689-833f-58f9ac9cbf91',
      port: process.env.PORT || 3000,
      logging: true,
      jwtKey: "CBiTJ1q6vfils4h7OJWnmD9UAitA7D8NjYmO0YJozcueHXHJzIl1g48qulklr5i",
      tempFilePath: "uploads/"
    },
    aws: {
      region: process.env.REGION || 'us-east-1',
      secretName: process.env.SECRETNAME || 'tsgallery.secrets.dbcluster',
      s3Bucket: process.env.S3_BUCKET || 'tsgallery.498289857405',
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
