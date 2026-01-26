/**
 * Electron Builder Configuration
 * 
 * Configures packaging for RonBrowser with Python tool management.
 * Key: asar.unpack ensures bundled_python and python_scripts are
 * extracted from the asar archive for direct filesystem access.
 */
module.exports = {
  appId: 'com.ronbrowser.app',
  productName: 'RonBrowser',
  
  directories: {
    buildResources: 'build',
    output: 'release'
  },
  
  // Files to include in the package
  files: [
    'dist/**/*',
    'bundled_python/**/*',
    'python_scripts/**/*',
    'package.json'
  ],
  
  // ASAR configuration - unpack Python-related directories
  asar: true,
  asarUnpack: [
    'bundled_python/**/*',
    'python_scripts/**/*'
  ],
  
  // macOS configuration
  mac: {
    category: 'public.app-category.productivity',
    target: ['dmg', 'zip'],
    icon: 'public/favicon.png',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist'
  },
  
  // Windows configuration
  win: {
    target: ['nsis', 'zip'],
    icon: 'public/favicon.png'
  },
  
  // Linux configuration
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Utility',
    icon: 'build/icons'
  },
  
  // DMG options for macOS
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' }
    ]
  },
  
  // NSIS options for Windows
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true
  }
};
