const ImageKit = require('imagekit');

const REQUIRED_ENV_VARS = [
  'IMAGEKIT_PUBLIC_KEY',
  'IMAGEKIT_PRIVATE_KEY',
  'IMAGEKIT_URL_ENDPOINT',
];

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

let imagekitClient = null;

if (missingEnvVars.length) {
  console.warn(
    `[ImageKit] Missing required environment variables: ${missingEnvVars.join(
      ', '
    )}. ImageKit features will be disabled until these are provided.`
  );
} else {
  imagekitClient = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
}

const getClient = () => {
  if (!imagekitClient) {
    throw new Error(
      `ImageKit is not configured. Missing environment variables: ${missingEnvVars.join(
        ', '
      )}`
    );
  }

  return imagekitClient;
};

module.exports = {
  getClient,
  isConfigured: () => Boolean(imagekitClient),
  getConfiguredFolder: () =>
    (process.env.IMAGEKIT_PROFILE_FOLDER || 'profile-pictures').replace(
      /^\/*/,
      ''
    ),
};

