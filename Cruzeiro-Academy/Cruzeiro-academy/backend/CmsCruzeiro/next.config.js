/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurações para reduzir warnings de Fast Refresh
  reactStrictMode: true,
  swcMinify: true,
  
  // Otimizações para desenvolvimento
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      esmExternals: 'loose',
    },
  }),
  
  // Configurações de webpack para melhor performance
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Configurações para melhorar Fast Refresh
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            default: false,
            vendors: false,
            // Keystone Admin UI bundle
            keystoneAdmin: {
              name: 'keystone-admin',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]@keystone-6[\\/]/,
              priority: 20,
            },
          },
        },
      };
    }
    
    return config;
  },
  
  // Configurações de headers para CORS
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
