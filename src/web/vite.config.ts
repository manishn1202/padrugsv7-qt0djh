// vite.config.ts
// Vite configuration for Enhanced Prior Authorization System
// Dependencies:
// - vite ^4.4.0
// - @vitejs/plugin-react ^4.0.0
// - vite-tsconfig-paths ^4.2.0

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import type { UserConfig } from 'vite';

export default defineConfig(({ command, mode }): UserConfig => {
  const isProduction = mode === 'production';

  return {
    // Plugin configuration
    plugins: [
      react({
        // Enable Fast Refresh for development
        fastRefresh: true,
        // Configure Babel for Emotion CSS-in-JS
        babel: {
          plugins: ['@emotion/babel-plugin']
        }
      }),
      // Enable TypeScript path aliases
      tsconfigPaths()
    ],

    // Build configuration
    build: {
      // Target modern browsers as per requirements
      target: ['es2020', 'chrome90', 'firefox85', 'safari14', 'edge90'],
      outDir: 'dist',
      assetsDir: 'assets',
      // Enable source maps for debugging
      sourcemap: true,
      // Use Terser for production minification
      minify: 'terser',
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Rollup-specific options
      rollupOptions: {
        output: {
          // Intelligent code splitting strategy
          manualChunks: {
            // Core vendor bundle
            vendor: ['react', 'react-dom'],
            // UI component library bundle
            ui: ['@mui/material', '@emotion/react'],
            // Form handling bundle
            forms: ['react-hook-form', 'yup'],
            // Utility functions bundle
            utils: ['lodash', 'date-fns'],
            // Data visualization bundle
            charts: ['recharts', 'd3']
          }
        }
      },
      // Terser optimization options
      terserOptions: {
        compress: {
          // Remove console logs and debugger statements in production
          drop_console: isProduction,
          drop_debugger: isProduction
        }
      }
    },

    // Development server configuration
    server: {
      port: 3000,
      strictPort: true,
      host: true,
      // API proxy configuration
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          ws: true // Enable WebSocket proxy
        }
      },
      // Enable CORS for development
      cors: true,
      // Hot Module Replacement settings
      hmr: {
        overlay: true
      }
    },

    // Path resolution configuration
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@hooks': '/src/hooks',
        '@services': '/src/services',
        '@utils': '/src/utils',
        '@types': '/src/types'
      }
    },

    // CSS processing configuration
    css: {
      modules: {
        // Configure CSS modules
        localsConvention: 'camelCase',
        scopeBehaviour: 'local',
        generateScopedName: isProduction
          ? '[hash:base64:8]'
          : '[name]__[local]___[hash:base64:5]'
      },
      // SCSS preprocessing configuration
      preprocessorOptions: {
        scss: {
          additionalData: '@import "@/assets/styles/variables.scss";'
        }
      },
      // Enable source maps for development
      devSourcemap: !isProduction
    },

    // Environment variable definitions
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __API_URL__: JSON.stringify(process.env.VITE_API_URL)
    },

    // Optimization configuration
    optimizeDeps: {
      // Include dependencies that need optimization
      include: [
        'react',
        'react-dom',
        '@mui/material',
        'react-hook-form',
        'lodash'
      ]
    },

    // Preview server configuration for production builds
    preview: {
      port: 3000,
      strictPort: true,
      host: true
    },

    // Enable detailed build analysis in production
    ...(isProduction && {
      build: {
        reportCompressedSize: true,
        chunkSizeWarningLimit: 1000
      }
    })
  };
});