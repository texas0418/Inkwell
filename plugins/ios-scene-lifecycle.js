// iOS 27 will not launch an app built with the iOS 27 SDK unless it adopts the scene life cycle.
// Expo SDK 57 ships ExpoAppSceneDelegate for this, but prebuild does not wire it up yet.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const START = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/;

function patchAppDelegate(src) {
  if (src.includes('SceneDelegate: ExpoAppSceneDelegate')) return src;
  return (
    src
      .replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
      .replace(START, '') +
    '\nclass SceneDelegate: ExpoAppSceneDelegate {}\n'
  );
}

module.exports = (config) => {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default', UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate' },
        ],
      },
    };
    return c;
  });
  return withAppDelegate(config, (c) => {
    c.modResults.contents = patchAppDelegate(c.modResults.contents);
    return c;
  });
};
module.exports.patchAppDelegate = patchAppDelegate;
