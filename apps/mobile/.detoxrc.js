/** Detox configuration for the SmartResidence Expo app.
 *
 * Run end-to-end tests against an iOS simulator or Android emulator with a
 * dev-client EAS build. CI typically runs only the smoke suite.
 */
module.exports = {
  testRunner: { args: { config: 'e2e/jest.config.js' } },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      build:
        'xcodebuild -workspace ios/SmartResidence.xcworkspace -scheme SmartResidence -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/SmartResidence.app',
    },
    'android.debug': {
      type: 'android.apk',
      build:
        'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath:
        'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
    },
  },
  devices: {
    'ios.simulator': {
      type: 'ios.simulator',
      device: { type: 'iPhone 15' },
    },
    'android.emulator': {
      type: 'android.emulator',
      device: { avdName: 'Pixel_5_API_34' },
    },
  },
  configurations: {
    'ios.sim.debug': { device: 'ios.simulator', app: 'ios.debug' },
    'android.emu.debug': { device: 'android.emulator', app: 'android.debug' },
  },
};
